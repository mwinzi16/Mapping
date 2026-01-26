declare module 'react-router-dom' {
  import * as React from 'react'
  
  export interface NavLinkRenderProps {
    isActive: boolean
    isPending: boolean
  }
  
  export interface NavLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
    to: string
    className?: string | ((props: NavLinkRenderProps) => string)
    children?: React.ReactNode
    end?: boolean
  }
  
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string
    children?: React.ReactNode
  }
  
  export interface RouteProps {
    path?: string
    element?: React.ReactNode
    children?: React.ReactNode
    index?: boolean
  }
  
  export const BrowserRouter: React.FC<{ children: React.ReactNode }>
  export const Routes: React.FC<{ children: React.ReactNode }>
  export const Route: React.FC<RouteProps>
  export const NavLink: React.FC<NavLinkProps>
  export const Link: React.FC<LinkProps>
  export const Outlet: React.FC
  
  export function useNavigate(): (to: string) => void
  export function useParams<T extends Record<string, string>>(): T
  export function useLocation(): { pathname: string; search: string; hash: string }
}
