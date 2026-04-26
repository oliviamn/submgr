import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { listProviderRuleSets, saveProviderRuleSet } from '../../lib/providerRuleStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const ruleSets = await listProviderRuleSets(env);

    return NextResponse.json({
      success: true,
      ruleSets,
      count: ruleSets.length,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to list provider rule sets',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function POST(request) {
  try {
    const { env } = getCloudflareContext();
    const payload = await request.json();
    const ruleSet = payload.ruleSet || payload;

    if (!ruleSet?.name && !ruleSet?.outbound) {
      return NextResponse.json({
        error: 'Missing provider rule set name',
      }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const savedRuleSet = await saveProviderRuleSet(env, ruleSet);

    return NextResponse.json({
      success: true,
      ruleSet: savedRuleSet,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to save provider rule set',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
