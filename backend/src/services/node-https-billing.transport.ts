import https from 'node:https';
import { BillingHttpRequest, BillingHttpResponse, BillingHttpTransport } from '@/billing/contracts';

export class BillingHttpResponseTooLargeError extends Error {
  constructor() {
    super('BILLING_HTTP_RESPONSE_TOO_LARGE');
    this.name = 'BillingHttpResponseTooLargeError';
  }
}

export class NodeHttpsBillingTransport implements BillingHttpTransport {
  async send(request: BillingHttpRequest): Promise<BillingHttpResponse> {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.username || url.password || request.redirect !== 'error') {
      throw new Error('Billing transport rejected the request target.');
    }
    const body = Buffer.from(request.body, 'utf8');
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishReject = (error: Error = new Error('Billing HTTPS request failed.')) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const outbound = https.request(
        url,
        {
          method: request.method,
          headers: { ...request.headers, 'content-length': String(body.byteLength) },
          timeout: request.timeoutMs,
          signal: request.signal,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let length = 0;
          response.on('data', (chunk: Buffer) => {
            length += chunk.byteLength;
            if (length > request.maxResponseBytes) {
              response.destroy();
              finishReject(new BillingHttpResponseTooLargeError());
              return;
            }
            chunks.push(Buffer.from(chunk));
          });
          response.on('end', () => {
            if (settled) return;
            settled = true;
            const contentType = response.headers['content-type'];
            resolve({
              status: response.statusCode || 0,
              body: Buffer.concat(chunks),
              headers: typeof contentType === 'string' ? { 'content-type': contentType } : {},
            });
          });
          response.on('error', finishReject);
        }
      );
      outbound.on('timeout', () => {
        outbound.destroy();
        finishReject();
      });
      outbound.on('error', finishReject);
      outbound.end(body);
    });
  }
}
