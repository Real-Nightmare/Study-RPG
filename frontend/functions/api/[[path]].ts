export interface Env {
  BACKEND_URL: string;
}

const BACKEND_URL = typeof env !== 'undefined' ? env.BACKEND_URL : '';

function getBackendUrl(path: string, search: string): string {
  if (!BACKEND_URL) {
    return new Response('BACKEND_URL is not configured', { status: 500 });
  }
  const base = BACKEND_URL.replace(/\/$/, '');
  return `${base}${path}${search}`;
}

async function proxyRequest(request: Request, path: string, search: string): Promise<Response> {
  const backendUrl = getBackendUrl(path, search);
  
  if (backendUrl instanceof Response) {
    return backendUrl;
  }

  const modifiedRequest = new Request(backendUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.blob()
      : undefined,
  });

  try {
    const response = await fetch(modifiedRequest);
    return response;
  } catch (error) {
    console.error('[API Proxy] Backend request failed:', error);
    return new Response('Backend unavailable', { status: 502 });
  }
}

export const onRequestGet = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const path = `/${context.params.path?.join('/') || ''}`;
  const search = new URL(context.request.url).search;
  return proxyRequest(context.request, path, search);
};

export const onRequestPost = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const path = `/${context.params.path?.join('/') || ''}`;
  const search = new URL(context.request.url).search;
  return proxyRequest(context.request, path, search);
};

export const onRequestPut = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const path = `/${context.params.path?.join('/') || ''}`;
  const search = new URL(context.request.url).search;
  return proxyRequest(context.request, path, search);
};

export const onRequestDelete = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const path = `/${context.params.path?.join('/') || ''}`;
  const search = new URL(context.request.url).search;
  return proxyRequest(context.request, path, search);
};

export const onRequestPatch = async (context: { request: Request; env: Env; params: { path?: string[] } }) => {
  const path = `/${context.params.path?.join('/') || ''}`;
  const search = new URL(context.request.url).search;
  return proxyRequest(context.request, path, search);
};

export const onRequestOptions = async (_context: { request: Request; env: Env }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
};
