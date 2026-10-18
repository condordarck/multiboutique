import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link } from "react-router";

/** Les liens de la coque (packages/ui) passent par le routeur, sans recharger la page. */
export const LienRouteur = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function LienRouteur({ href = "/", ...reste }, ref) {
    return <Link ref={ref} to={href} {...reste} />;
  }
);
