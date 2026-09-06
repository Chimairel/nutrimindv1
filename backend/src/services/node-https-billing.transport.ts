import https from 'node:https';
import { BillingHttpRequest, BillingHttpResponse, BillingHttpTransport } from '@/billing/contracts';

export class NodeHttpsBillingTransport implements BillingHttpTransport {
  async send(request: BillingHttpRequest): Promise<BillingHttpResponse> {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.username || url.password || request.redirect !== 'error') {
      throw new Error('Billing transport rejected the request target.');
    }
    const body = Buffer.from(request.body, 'utf8');
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishReject = () => {
        if (settled) return;
        settled = true;
        reject(new Error('Billing HTTPS request failed.'));
      };
      const outbound = https.request(url, {
        method: request.method,
        headers: { ...request.headers, 'content-length': String(body.byteLength) },
        timeout: request.timeoutMs,
      }, (response) => {
        const chunks: Buffer[] = [];
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.byteLength;
          if (length > request.maxResponseBytes) {
            response.destroy();
            finishReject();
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        response.on('end', () => {
          if (settled) return;
          settled = true;
          resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) });
        });
        response.on('error', finishReject);
      });
      outbound.on('timeout', () => {
        outbound.destroy();
        finishReject();
      });
      outbound.on('error', finishReject);
      outbound.end(body);
    });
  }
}
