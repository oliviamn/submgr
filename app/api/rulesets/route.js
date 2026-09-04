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

    const isGeneral = ruleSet.kind === 'general';
    const generalRules = ruleSet.rules?.general || {};

    if (isGeneral) {
      const skipProxy = Array.isArray(generalRules.skip_proxy) ? generalRules.skip_proxy.filter(Boolean) : [];
      const tunExcludedRoutes = Array.isArray(generalRules.tun_excluded_routes) ? generalRules.tun_excluded_routes.filter(Boolean) : [];
      const alwaysRealIp = Array.isArray(generalRules.always_real_ip) ? generalRules.always_real_ip.filter(Boolean) : [];

      if (skipProxy.length === 0 && tunExcludedRoutes.length === 0 && alwaysRealIp.length === 0) {
        return NextResponse.json({
          error: 'General rule sets need at least one skip-proxy, tun-excluded-routes or always-real-ip entry',
        }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      ruleSet.rules = { general: { skip_proxy: skipProxy, tun_excluded_routes: tunExcludedRoutes, always_real_ip: alwaysRealIp } };
    } else {
      ruleSet.kind = 'routing';
      if (ruleSet.rules) {
        delete ruleSet.rules.general;
      }
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
