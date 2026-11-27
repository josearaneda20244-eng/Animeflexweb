import CatalogPage from "@/components/iz/CatalogPage";

export default function Movies() {
  return (
    <CatalogPage
      eyebrow="Catálogo"
      title="Películas"
      serif="de anime"
      description="Las mejores películas de anime en HD con subtítulos en español."
      formats={[{ label: "Películas", value: "MOVIE" }]}
      badge="PELÍCULA"
    />
  );
}
