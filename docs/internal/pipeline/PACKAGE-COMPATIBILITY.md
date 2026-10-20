# Pipeline package compatibility surface

Pipeline 2.0.0 is the package-root API. The package root does not expose the
Pipeline 1.4 API. The public `@wpkernel/pipeline/v1` subpath provides a serial
compatibility adapter; it does not recreate the original 1.4 source surface.
Historical 1.4.1 consumer pins remain external dependency boundaries.

These distinctions describe package and compatibility boundaries only. They do
not prove every downstream consumer has migrated; each consumer owns its own
version selection and qualification.
