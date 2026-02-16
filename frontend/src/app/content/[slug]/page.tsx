import { PortableText } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";
import { isSanityConfigured, sanityClient } from "@/lib/sanity";

type PageData = {
  title?: string;
  body?: PortableTextBlock[];
};

export default async function ContentPage({ params }: { params: { slug: string } }) {
  if (!isSanityConfigured || !sanityClient) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="glass-panel rounded-[32px] p-8">
          <h1 className="text-2xl font-semibold text-(--color-deep)">
            Innehåll ej konfigurerat
          </h1>
          <p className="mt-3 text-sm text-(--color-forest)">
            Lägg till SANITY-projekt, dataset och API-version i miljövariablerna för att
            aktivera dynamiskt innehåll.
          </p>
        </div>
      </div>
    );
  }

  const data = await sanityClient.fetch<PageData>(
    `*[_type == "page" && slug.current == $slug][0]{title, body}`,
    { slug: params.slug }
  );

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Sidan hittades inte.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">{data.title}</h1>
        <div className="prose mt-6 max-w-none text-sm text-(--color-forest)">
          <PortableText value={data.body ?? []} />
        </div>
      </div>
    </div>
  );
}


