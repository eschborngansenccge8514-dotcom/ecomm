export class MetaClient {
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';

  constructor(private readonly accessToken: string) {}

  protected async fetch<T>(path: string, options: RequestInit & { json?: any } = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path}`);
    if (options.method === 'GET' || !options.method) {
      url.searchParams.set('access_token', this.accessToken);
    }

    const body = options.json 
      ? JSON.stringify({ ...options.json, access_token: this.accessToken })
      : options.body;

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    return response.json() as Promise<T>;
  }
}
