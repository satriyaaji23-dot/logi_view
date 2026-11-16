import { NextResponse } from 'next/server';

function maskToken(token?: string): string {
  if (!token) return '';
  if (token.length <= 10) return '****';
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export async function GET() {
  const cctvToken = process.env.CCTV_API_TOKEN ?? '';
  const cctvUrl = process.env.CCTV_API_BASE_URL ?? '';
  const gpsToken = process.env.GPS_API_TOKEN ?? '';
  const gpsUrl = process.env.GPS_API_BASE_URL ?? '';
  const webhookToken = process.env.WEBHOOK_API_TOKEN ?? '';
  const webhookUrl = process.env.WEBHOOK_API_URL ?? '';

  return NextResponse.json({
    cctv: {
      hasEnvToken: Boolean(cctvToken),
      hasEnvBaseUrl: Boolean(cctvUrl),
      tokenPreview: maskToken(cctvToken),
    },
    gps: {
      hasEnvToken: Boolean(gpsToken),
      hasEnvBaseUrl: Boolean(gpsUrl),
      tokenPreview: maskToken(gpsToken),
    },
    webhook: {
      hasEnvToken: Boolean(webhookToken),
      hasEnvBaseUrl: Boolean(webhookUrl),
      tokenPreview: maskToken(webhookToken),
    },
  });
}

