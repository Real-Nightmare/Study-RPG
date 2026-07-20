export async function onRequest(context: {
  request: Request;
  env: { BACKEND_URL: string };
  next: (input?: Request | string) => Promise<Response>;
}) {
  const backendUrl = context.env.BACKEND_URL || 'https://your-backend.opsctrl.dev';
  const url = new URL(context.request.url);
  
  const response = await fetch(`${backendUrl}${url.pathname}${url.search}`, {
    method: context.request.method,
    headers: {
      ...Object.fromEntries(context.request.headers.entries()),
      'X-Forwarded-Host': url.host,
      'X-Forwarded-Proto': url.protocol.replace(':', ''),
    },
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD' 
      ? await context.request.text() 
      : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  });
}
