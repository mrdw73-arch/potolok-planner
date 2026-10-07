# Import sources

## Maytoni
Maytoni provides partner downloads including current assortment data. Its official FAQ states that the Downloads section contains a CSV with current assortment data, specifications, photo links and instructions. The importer is therefore designed around a CSV feed rather than scraping product HTML.

Official source: https://maytoni.de/en/media/downloads/

### Required mapping
- article / SKU -> sku
- name / title -> name
- category -> category
- description -> description
- price -> price
- stock -> stock
- image / imageUrl -> image
- url -> sourceUrl

Credentials or partner-only feed URLs must be stored as environment secrets, never committed to Git.
