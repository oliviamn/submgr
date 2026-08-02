import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { deleteProviderRuleSet, getProviderRuleSet, saveProviderRuleSet } from '../../../lib/providerRuleStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { env } = getCloudflareContext();
    const ruleSet = await getProviderRuleSet(env, id);

    if (!ruleSet) {
      return NextResponse.json({
        error: 'Provider rule set not found',
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    return NextResponse.json({
      success: true,
      ruleSet,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get provider rule set',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { env } = getCloudflareContext();
    const payload = await request.json();
    const ruleSet = payload.ruleSet || payload;
    const existingRuleSet = await getProviderRuleSet(env, id);

    if (!existingRuleSet) {
      return NextResponse.json({
        error: 'Provider rule set not found',
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    const savedRuleSet = await saveProviderRuleSet(env, {
      ...existingRuleSet,
      ...ruleSet,
      id,
    });

    return NextResponse.json({
      success: true,
      ruleSet: savedRuleSet,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to update provider rule set',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { env } = getCloudflareContext();
    const existingRuleSet = await getProviderRuleSet(env, id);

    if (!existingRuleSet) {
      return NextResponse.json({
        error: 'Provider rule set not found',
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    await deleteProviderRuleSet(env, id);

    return NextResponse.json({
      success: true,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete provider rule set',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
