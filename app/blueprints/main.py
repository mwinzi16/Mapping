"""Web UI routes — serves Jinja2 templates."""
from __future__ import annotations

from flask import Blueprint, redirect, render_template, url_for

bp = Blueprint("main", __name__)


@bp.route("/")
def index() -> str:
    """Render the main dashboard page."""
    return render_template("pages/index.html")


@bp.route("/parametric")
def parametric_index() -> str:
    """Redirect /parametric to /parametric/live."""
    return redirect(url_for("main.parametric_live"))


@bp.route("/parametric/live")
def parametric_live() -> str:
    """Render the real-time parametric tracking page."""
    return render_template("pages/parametric_live.html")


@bp.route("/parametric/historical")
def parametric_historical() -> str:
    """Render the parametric historical analysis page."""
    return render_template("pages/parametric_historical.html")


@bp.route("/indemnity")
def indemnity_index() -> str:
    """Redirect /indemnity to /indemnity/live."""
    return redirect(url_for("main.indemnity_live"))


@bp.route("/indemnity/live")
def indemnity_live() -> str:
    """Render the indemnity live cat page."""
    return render_template("pages/indemnity_live.html")


@bp.route("/indemnity/historical")
def indemnity_historical() -> str:
    """Render the indemnity historical analysis page."""
    return render_template("pages/indemnity_historical.html")
