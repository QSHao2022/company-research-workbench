const corsHeaders = {
  "Access-Control-Allow-Origin": "https://qshao2022.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: {type:"string"}, date: {type:"string"}, title: {type:"string"},
    minutes: {type:"string"}, above: {type:"string"}, below: {type:"string"},
    followup: {type:"string"}, judgment: {type:"string"}
  },
  required: ["company","date","title","minutes","above","below","followup","judgment"]
};

const instructions = `你是一名严谨的中国化工、石化行业卖方研究助理。请将原始业绩会、调研或电话会纪要整理成正式纪要。
必须遵守：
1. 只依据原始纪要，不联网，不补充外部事实，不擅自纠错。原文没有的数据不得编造；口径冲突、数字疑似错误或时间不清时标注“原文口径/待核实”。
2. 保留核心经营数据、同比/环比、产能、产量、销量、价格、价差、库存、开工率、成本、资本开支、项目进度、管理层判断及关键客户/竞争格局。不要为简短删除有投资价值的信息。
3. 合并重复内容，但保留不同时间段、不同口径和不同管理层表述的区别。不要把推测写成事实。
4. minutes 为正式纪要正文，按知识点设置小标题，建议按业绩总览与财务、分业务经营、产能及项目、行业供需与竞争、成本盈利、资本运作组织。只保留相关章节。使用连续段落表达，必要时列关键数据。
5. above：超预期或修正此前判断的地方。若原文没有明确预期基准，说明是基于本次交流的初步判断。
6. below：低于预期或需要打折扣的地方。区分管理层明确表述与分析推断，指出兑现风险和口径限制。
7. followup：本次没问到、需补问或核实的问题，必须具体可执行，优先围绕盈利预测、产能兑现、价格成本、现金流和资本开支。
8. judgment：按“原有判断/本次新增信息/当前判断/后续验证指标”组织。若未提供原有判断，明确写“原有判断未在本次材料中提供”。
9. 客观、专业、审慎；避免空话、宣传式表述和无依据投资建议。中文输出。
10. 允许修正明显语音转写错字，但专有名词、数字、公司名称不确定时保留原样并标注待核实。`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:corsHeaders});
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://qshao2022.github.io";
    if (origin !== allowed) return Response.json({error:"Origin not allowed"},{status:403,headers:corsHeaders});
    if (request.method !== "POST") return Response.json({error:"Method not allowed"},{status:405,headers:corsHeaders});
    try {
      if (!env.OPENAI_API_KEY) throw new Error("Worker 尚未配置 OPENAI_API_KEY secret");
      const body = await request.json();
      const raw = typeof body.raw === "string" ? body.raw.trim() : "";
      if (!raw) return Response.json({error:"原始纪要不能为空"},{status:400,headers:corsHeaders});
      if (raw.length > 60000) return Response.json({error:"原始纪要超过60,000字符，请拆分后整理"},{status:413,headers:corsHeaders});
      const input = [
        "公司名称："+(body.company||"未填写"),
        "会议日期："+(body.date||"未填写"),
        "标题："+(body.title||"未填写"),
        "",
        "以下为原始纪要全文，请严格按要求整理：",
        raw
      ].join("\n");
      const response = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-6-luna",
          service_tier:"fast",
          instructions,
          input,
          text:{format:{type:"json_schema",name:"company_research_minutes",strict:true,schema}},
          max_output_tokens:10000
        })
      });
      const payload = await response.json();
      if (!response.ok) return Response.json({error:"OpenAI API "+response.status,detail:payload.error?.message||JSON.stringify(payload).slice(0,1200)},{status:502,headers:corsHeaders});
      const outputText=(payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
      if (!outputText) throw new Error("模型没有返回结构化正文");
      const result=JSON.parse(outputText);
      result.usage=payload.usage||null;
      return Response.json(result,{headers:{...corsHeaders,"Cache-Control":"no-store"}});
    } catch(error) {
      return Response.json({error:error.message||"整理失败"},{status:500,headers:corsHeaders});
    }
  }
};
