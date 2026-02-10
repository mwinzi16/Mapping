"""Catastrophe Mapping API — Flask Application Factory."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from flask import Flask, g, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

from app.config import Settings
from app.core.exceptions import AppError
from app.core.logging import setup_logging
from app.core.response import error_response


def create_app(config_class: type[Settings] | None = None) -> Flask:
    """Create and configure the Flask application.

    Uses the Application Factory pattern.  Initialises extensions,
    registers blueprints, error handlers, middleware hooks and the
    health / metrics endpoints.

    Args:
        config_class: Optional settings *class* (not instance).
            When ``None`` a default ``Settings`` object is created
            from environment variables.

    Returns:
        A fully configured Flask application.
    """
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    # Load config --------------------------------------------------------
    config = config_class() if config_class is not None else Settings()
    app.config.from_object(config)
    app.config["SETTINGS"] = config
    app.config["SECRET_KEY"] = config.SECRET_KEY

    # Structured logging -------------------------------------------------
    setup_logging(config.DEBUG)

    # Initialize extensions ----------------------------------------------
    from app.extensions import init_extensions

    init_extensions(app)

    # Register blueprints ------------------------------------------------
    _register_blueprints(app)

    # Register error handlers --------------------------------------------
    _register_error_handlers(app)

    # Register before / after request hooks ------------------------------
    from app.core.middleware import register_middleware

    register_middleware(app)

    # Health-check endpoint ----------------------------------------------
    _register_health_check(app)

    # Prometheus metrics endpoint ----------------------------------------
    from app.core.metrics import metrics_bp

    app.register_blueprint(metrics_bp)

    # Background monitoring thread (started on first request) ------------
    _register_background_monitor(app)

    return app


# -----------------------------------------------------------------------
# Blueprint registration
# -----------------------------------------------------------------------


def _register_blueprints(app: Flask) -> None:
    """Register all route-group blueprints.

    Each blueprint is mounted at the URL prefix specified in the
    project architecture document.
    """
    from app.blueprints.main import bp as main_bp
    from app.blueprints.api_earthquakes import bp as earthquakes_bp
    from app.blueprints.api_hurricanes import bp as hurricanes_bp
    from app.blueprints.api_wildfires import bp as wildfires_bp
    from app.blueprints.api_severe_weather import bp as severe_weather_bp
    from app.blueprints.api_subscriptions import bp as subscriptions_bp
    from app.blueprints.api_parametric import bp as parametric_bp
    from app.blueprints.api_earthquake_parametric import bp as eq_parametric_bp
    from app.blueprints.api_indemnity import bp as indemnity_bp

    app.register_blueprint(main_bp, url_prefix="/")
    app.register_blueprint(earthquakes_bp, url_prefix="/api/v1/earthquakes")
    app.register_blueprint(hurricanes_bp, url_prefix="/api/v1/hurricanes")
    app.register_blueprint(wildfires_bp, url_prefix="/api/v1/wildfires")
    app.register_blueprint(severe_weather_bp, url_prefix="/api/v1/severe-weather")
    app.register_blueprint(subscriptions_bp, url_prefix="/api/v1/subscriptions")
    app.register_blueprint(parametric_bp, url_prefix="/api/v1/parametric")
    app.register_blueprint(eq_parametric_bp, url_prefix="/api/v1/earthquake-parametric")
    app.register_blueprint(indemnity_bp, url_prefix="/api/v1/indemnity")


# -----------------------------------------------------------------------
# Error handlers
# -----------------------------------------------------------------------


def _is_api_request() -> bool:
    """Return ``True`` when the current request targets an API route."""
    return request.path.startswith("/api/")


def _register_error_handlers(app: Flask) -> None:
    """Register global error handlers.

    API routes receive JSON error envelopes; web routes receive
    rendered HTML error pages when templates are available.
    """
    logger = logging.getLogger(__name__)

    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):  # type: ignore[return]
        """Handle custom application errors."""
        if _is_api_request():
            return (
                jsonify(error_response(exc.code, exc.message, exc.details)),
                exc.status_code,
            )
        return (
            render_template(
                "errors/generic.html",
                code=exc.status_code,
                message=exc.message,
            ),
            exc.status_code,
        )

    @app.errorhandler(404)
    def handle_404(exc: HTTPException):  # type: ignore[return]
        """Handle 404 Not Found."""
        if _is_api_request():
            return jsonify(error_response("NOT_FOUND", "Resource not found")), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(422)
    def handle_422(exc: HTTPException):  # type: ignore[return]
        """Handle 422 Unprocessable Entity."""
        if _is_api_request():
            return (
                jsonify(error_response("VALIDATION_ERROR", "Unprocessable entity")),
                422,
            )
        return render_template("errors/generic.html", code=422, message="Validation error"), 422

    @app.errorhandler(500)
    def handle_500(exc: Exception):  # type: ignore[return]
        """Handle 500 Internal Server Error — never expose stack traces."""
        logger.exception("Unhandled exception on %s %s", request.method, request.path)
        if _is_api_request():
            return (
                jsonify(error_response("INTERNAL_ERROR", "An unexpected error occurred")),
                500,
            )
        return render_template("errors/500.html"), 500

    @app.errorhandler(HTTPException)
    def handle_http_error(exc: HTTPException):  # type: ignore[return]
        """Handle any other standard HTTP errors."""
        code_str = exc.name.upper().replace(" ", "_")
        if _is_api_request():
            return (
                jsonify(error_response(code_str, exc.description or exc.name)),
                exc.code,
            )
        return (
            render_template(
                "errors/generic.html",
                code=exc.code,
                message=exc.description or exc.name,
            ),
            exc.code,
        )


# -----------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------


def _register_health_check(app: Flask) -> None:
    """Register the ``/api/v1/health`` endpoint."""

    @app.route("/api/v1/health")
    def health_check():
        """Return health status including database connectivity.

        Returns:
            JSON payload with component health statuses.
        """
        from app.extensions import db

        status = "healthy"
        components: dict[str, str] = {}

        # Database check
        try:
            db.session.execute(db.text("SELECT 1"))
            components["database"] = "up"
        except Exception:
            components["database"] = "down"
            status = "degraded"

        return jsonify(
            {
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "components": components,
            }
        )


# -----------------------------------------------------------------------
# Background monitoring
# -----------------------------------------------------------------------


def _register_background_monitor(app: Flask) -> None:
    """Start a background monitoring thread on first request.

    The thread is only started once and is guarded by an application-
    level flag so that reloads in development do not spawn duplicates.
    """
    logger = logging.getLogger(__name__)

    @app.before_request
    def _start_monitor_once() -> None:
        if app.config.get("_MONITOR_STARTED"):
            return
        app.config["_MONITOR_STARTED"] = True
        logger.info("Background monitoring thread placeholder activated.")
