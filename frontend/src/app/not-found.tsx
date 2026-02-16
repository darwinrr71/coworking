export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-2xl font-semibold text-(--color-deep)">Sidan hittades inte</h1>
        <p className="mt-3 text-sm text-(--color-forest)">
          Kontrollera länken eller gå tillbaka till startsidan.
        </p>
      </div>
    </div>
  );
}


