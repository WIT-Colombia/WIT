# Fixtures locales de auditoría responsive

`localApiMocks.ts` intercepta únicamente las llamadas `/api/v1` del navegador de Playwright y responde con datos ficticios en memoria para una cuenta de Business propietaria y un administrador con permisos completos.

Las respuestas no se escriben en MySQL, no usan credenciales y no sustituyen la autenticación de producción. Para reutilizarlas, llama a `installLocalApiMocks(page)` antes de navegar a una ruta protegida.
