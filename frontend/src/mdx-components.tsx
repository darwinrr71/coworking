import type { ReactElement } from "react";

type MDXProps = Record<string, unknown>;
type MDXComponents = Record<string, (props: MDXProps) => ReactElement>;

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 className="mb-4 text-3xl font-semibold text-(--color-deep)" {...props} />,
    h2: (props) => <h2 className="mb-3 text-2xl font-semibold text-(--color-deep)" {...props} />,
    p: (props) => <p className="mb-4 text-sm leading-relaxed text-(--color-forest)" {...props} />,
    ...components,
  };
}


