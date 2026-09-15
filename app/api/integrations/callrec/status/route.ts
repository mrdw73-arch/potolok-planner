import { NextResponse } from 'next/server';
import { isCallRecConfigured } from '../../../../../lib/integrations/callrec';

export async function GET() {
  return NextResponse.json({
    provider: 'callrec',
    configured: isCallRecConfigured(),
    apiUrlConfigured: Boolean(process.env.CALLREC_API_URL),
    tokenConfigured: Boolean(process.env.CALLREC_JWT_TOKEN),
  });
}
