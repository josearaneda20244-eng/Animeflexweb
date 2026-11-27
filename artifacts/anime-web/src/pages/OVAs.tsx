import CatalogPage from "@/components/iz/CatalogPage";

export default function OVAs() {
  return (
    <CatalogPage
      eyebrow="Catálogo"
      title="OVAs, ONAs y"
      serif="especiales"
      description="Episodios extra, historias paralelas y especiales de tus series favoritas."
      formats={[
        { label: "OVAs", value: "OVA" },
        { label: "ONAs", value: "ONA" },
        { label: "Especiales", value: "SPECIAL" },
      ]}
    />
  );
}
