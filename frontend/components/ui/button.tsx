"use client";
import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;
export default function Button({ children, ...rest }: Props) {
  return <button {...rest}>{children}</button>;
}
