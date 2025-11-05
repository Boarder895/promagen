type Props = { children?: React.ReactNode };
export default function Markdown({ children }: Props) {
  return <div className="prose prose-invert max-w-none">{children}</div>;
}



