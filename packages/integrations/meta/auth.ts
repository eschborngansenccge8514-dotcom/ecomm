export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
  url.searchParams.set('grant_type',        'fb_exchange_token');
  url.searchParams.set('client_id',         appId);
  url.searchParams.set('client_secret',     appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Token exchange failed' }));
    throw new Error(`Meta Auth Error: ${JSON.stringify(error)}`);
  }

  const data = await res.json<{ access_token: string; expires_in: number }>();

  return {
    accessToken: data.access_token,
    expiresIn:   data.expires_in, // ~5,183,944 seconds (60 days)
  };
}

export async function refreshLongLivedToken(
  longLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  // Long-lived tokens can be refreshed by exchanging them for a new long-lived token
  return exchangeForLongLivedToken(longLivedToken, appId, appSecret);
}
