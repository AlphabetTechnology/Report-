(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,67312,93930,e=>{"use strict";let t=e=>{if(e instanceof Error)return e;if("object"==typeof e&&null!==e){try{let t=Object.prototype.toString.call(e);if("[object Error]"===t||"[object DOMException]"===t){let t=Error(e.message,e.cause?{cause:e.cause}:{});return e.stack&&(t.stack=e.stack),e.cause&&!t.cause&&(t.cause=e.cause),e.name&&(t.name=e.name),t}}catch{}try{return Error(JSON.stringify(e))}catch{}}return Error(e)};e.s(["castToError",0,t,"isAbortError",0,function(e){return"object"==typeof e&&null!==e&&("name"in e&&"AbortError"===e.name||"message"in e&&String(e.message).includes("FetchRequestCanceledException"))}],93930);var n=class extends Error{};class i extends n{constructor(e,t,n,o,r){super(`${i.makeMessage(e,t,n)}`),this.status=e,this.headers=o,this.requestID=o?.get("request-id"),this.workspaceID=o?.get("anthropic-workspace-id"),this.error=t,this.type=r??null}static makeMessage(e,t,n){let i=t?.message?"string"==typeof t.message?t.message:JSON.stringify(t.message):t?JSON.stringify(t):n;return e&&i?`${e} ${i}`:e?`${e} status code (no body)`:i||"(no status code or body)"}static generate(e,n,h,g){if(!e||!g)return new o({message:h,cause:t(n)});let p=n?.error?.type;return 400===e?new r(e,n,h,g,p):401===e?new a(e,n,h,g,p):403===e?new s(e,n,h,g,p):404===e?new c(e,n,h,g,p):409===e?new l(e,n,h,g,p):422===e?new u(e,n,h,g,p):429===e?new d(e,n,h,g,p):e>=500?new m(e,n,h,g,p):new i(e,n,h,g,p)}}class o extends i{constructor({message:e,cause:t}){super(void 0,void 0,e||"Connection error.",void 0),t&&(this.cause=t)}}class r extends i{}class a extends i{}class s extends i{}class c extends i{}class l extends i{}class u extends i{}class d extends i{}class m extends i{}e.s(["APIConnectionError",0,o,"APIConnectionTimeoutError",0,class extends o{constructor({message:e}={}){super({message:e??"Request timed out."})}},"APIError",0,i,"APIUserAbortError",0,class extends i{constructor({message:e}={}){super(void 0,void 0,e||"Request was aborted.",void 0)}},"AnthropicError",0,n,"AuthenticationError",0,a,"BadRequestError",0,r,"ConflictError",0,l,"InternalServerError",0,m,"NotFoundError",0,c,"PermissionDeniedError",0,s,"RateLimitError",0,d,"RetryableError",0,class extends n{constructor(e,{cause:t}={}){super(e??"Retryable error."),void 0!==t&&(this.cause=t)}},"UnprocessableEntityError",0,u],67312)},61893,e=>{e.v(t=>Promise.all(["static/chunks/0ug_mhp0r_cce.js"].map(t=>e.l(t))).then(()=>t(4378)))},78758,e=>{e.v(t=>Promise.all(["static/chunks/36zpjju_3a9nm.js"].map(t=>e.l(t))).then(()=>t(21474)))},5567,e=>{"use strict";var t=e.i(67312);e.s(["DEFAULT_MEMORY_SYNC_INTERVAL_MS",0,15e3,"MIN_MEMORY_SYNC_INTERVAL_MS",0,5e3,"checkMemorySyncInterval",0,function(e,n){if(!(e>=5e3))throw new t.AnthropicError(`${n} must be at least 5000ms (got ${e}); to run without memory sync, pass \`memorySyncIntervalMs: null\` to the worker instead`)}])},5577,e=>{"use strict";var t=e.i(62201),n=e.i(27639),i=e.i(41941);let o=`EXECUTIVE SUMMARY
September maintained Aakaar's social presence across Facebook and Instagram, with the strongest response coming from **child-development education, communication-focused messaging and culturally relevant content.**

Facebook generated **296 organic views and 27 content interactions**, while Instagram delivered **1,418 platform views, reached 253 accounts and generated 58 interactions**. Instagram continued to provide the broader content-discovery opportunity, while the existing audience remains strongly concentrated in India.

ACCOUNT REACH - Facebook
Viewers: 149
Facebook continued reaching users organically throughout September, maintaining visibility around Aakaar's educational and family-focused content.

ACCOUNT REACH - Instagram
Reach: 253
Instagram continued introducing Aakaar's content to relevant audiences, with educational child-development posts generating consistent visibility.

ACCOUNT VIEWS - Facebook
Views: 296 / 3-Second Video Views: 10 / Watch Time: 1m 26s
Facebook visibility was generated organically, providing a useful foundation for continued content-led audience building.

ENGAGEMENT - Instagram
Content Interactions: 58
Instagram generated stronger interaction volume, reinforcing the value of clear, parent-friendly educational content.

ACCOUNT VISITS - Instagram
Profile Visits: 35 / New Follows: 4
Instagram continued generating profile discovery and new audience growth alongside content engagement.

AUDIENCE - Facebook
Lifetime Followers: 1,089 / Gender: Women 60.5%, Men 39.5%
The Facebook audience is strongest within the 25–44 age range, aligning well with parents and family decision-makers.
Locations text: Facebook maintains a strongly India-focused audience while also providing visibility among international communities.

TOP CONTENT - Instagram
"Communication Starts Before First Words" — 193 views and 5 likes.
"They Know What They Want to Say..." — 192 views and 4 likes.
Ganesh Chaturthi Content — 161 views, 12 likes and 2 shares.
Summary: The strongest Instagram themes combined **practical parent education, communication awareness and culturally relevant moments.**

FOCUS FOR THE NEXT MONTH
Expand Parent Education
Current Situation: Communication-focused content is attracting consistent audience interest.
Implementation: We will create more simple, parent-friendly developmental guidance.

Strengthen Local Visibility
Current Situation: Navi Mumbai and Mumbai form the core Instagram audience.
Implementation: We will increase locally relevant messaging around Aakaar's services.

CONCLUSION
September maintained Aakaar's visibility across Facebook and Instagram while providing clear insight into the content themes that resonate most strongly with the audience.

Parent education, communication awareness, child-development guidance and culturally relevant content remain the strongest opportunities. Moving forward, we will build on these themes with more localised content, short-form video, educational storytelling and clearer pathways for parents to learn about Aakaar's services.`,r=t.enum(n.PLATFORMS),a=t.object({label:t.string(),value:t.string()}),s=t.object({name:t.string(),value:t.string()}),c=t.object({executiveSummary:t.string(),blocks:t.array(t.object({section:t.enum(["reach","views","engagement","visits"]),platform:r,metrics:t.array(a),text:t.string()})),audience:t.array(t.object({platform:r,metrics:t.array(a),gender:t.array(a),text:t.string(),locations:t.array(s),countries:t.array(s),locationsText:t.string()})),topContent:t.array(t.object({platform:r,items:t.array(t.object({title:t.string(),detail:t.string()})),summary:t.string()})),focus:t.array(t.object({title:t.string(),situation:t.string(),implementation:t.string()})),conclusion:t.string()});async function l(e,t){var n;let r={client:t.client.name,aboutClient:t.client.description||"(no description given)",website:t.client.website||void 0,reportingPeriod:t.period,month:t.month,platforms:t.platforms,screenshots:t.shots.filter(e=>e.extraction).map(e=>({platform:e.platform,kind:e.kind,section:e.section,data:e.extraction}))};return(0,i.structuredCall)(e,{schema:c,system:(n=t.client.english,`You write the text of monthly social media performance reports for SWS (Strategic Web Success), a digital marketing agency, for its clients.

Write in ${"en-GB"===n?"British English (organisation, behaviour, localised, analyse, programme)":"American English (organization, behavior, localized, analyze, program)"}. Write dates the ${"en-GB"===n?"UK way: 14 September, 1 – 30 September 2026":"US way: September 14, September 1 – 30, 2026"}. Tone: professional, positive but honest, concise, written by the agency to the client ("we will..."). No hype, no emojis, no exclamation marks. Use "–" for ranges (25–44) and "—" between a post title and its stats.

Use only the numbers provided in the screenshot data. Never invent, estimate or round numbers differently. If a number is not provided, leave it out rather than guessing. Do not compare with previous months unless the data includes previous figures.

What to produce:
- executiveSummary: two short paragraphs separated by a blank line. First: overall picture for the month and which content themes worked. Second: headline numbers per platform. Wrap the key numbers and key themes in **double asterisks** for bold, as in the example.
- blocks: one entry per platform for each of the sections reach, views, engagement and visits that has data for that platform. metrics are the figures to list for that section (label in Title Case, value exactly as given), e.g. reach → Viewers or Reach; views → Views, 3-Second Video Views, Watch Time; engagement → Content Interactions, Likes, Comments, Shares; visits → Page Visits or Profile Visits, New Follows. text is one or two sentences (about 20–35 words) interpreting the numbers. Skip a platform/section with no data.
- audience: one entry per platform with demographic or location data. metrics such as Lifetime Followers; gender as given; text one or two sentences on age and gender (mention the strongest age range); locations = the top 5 cities, countries = the top 5 countries, exactly as given; locationsText one or two sentences on where the audience is.
- topContent: one entry per platform with top posts. items: up to 5 posts, title in Title Case, quoted when it is a caption (e.g. "Communication Starts Before First Words") or a descriptive name for festival/occasion posts (e.g. Ganesh Chaturthi Content); detail like "193 views and 5 likes." summary: one sentence on the themes that worked, with the key themes in **bold**.
- focus: 5 or 6 recommendations for next month, grounded in the data. title: 2–5 words, Title Case, starting with a verb (e.g. "Expand Parent Education"). situation: one sentence on what the data shows. implementation: one sentence starting with "We will".
- conclusion: two short paragraphs separated by a blank line.

Use the client's name naturally. Keep platform names capitalised correctly (Facebook, Instagram, TikTok, YouTube, Reels, Shorts).

Here is an approved report written in the house style. Match its tone and length, not its content:

<example>
${o}
</example>`),effort:"medium",maxTokens:16e3,content:`Write the report text from this data.

<report_data>
${JSON.stringify(r,null,1)}
</report_data>`})}e.s(["writeReport",0,l],5577)},27639,e=>{"use strict";e.s(["KIND_SECTION",0,{content_overview:"executive",reach:"reach",views:"views",profile_grid:"views",interactions:"engagement",visits:"visits",follows:"visits",demographics:"audience",locations:"audience",top_content:"top_content",other:"executive"},"PLATFORMS",0,["facebook","instagram","tiktok","youtube"],"PLATFORM_LABEL",0,{facebook:"Facebook",instagram:"Instagram",tiktok:"TikTok",youtube:"YouTube"},"SECTIONS",0,[{key:"executive",title:"Executive Summary"},{key:"reach",title:"Account Reach"},{key:"views",title:"Account Views"},{key:"engagement",title:"Engagement"},{key:"visits",title:"Account Visits"},{key:"audience",title:"Audience Overview"},{key:"top_content",title:"Top Content"},{key:"focus",title:"Focus for the Next Month"},{key:"conclusion",title:"Conclusion"}],"SHOT_KINDS",0,["content_overview","reach","views","profile_grid","interactions","visits","follows","demographics","locations","top_content","other"],"SHOT_KIND_LABEL",0,{content_overview:"Content overview",reach:"Reach / viewers",views:"Views",profile_grid:"Profile grid (phone)",interactions:"Interactions",visits:"Visits",follows:"Follows",demographics:"Age & gender",locations:"Cities & countries",top_content:"Top content",other:"Other"},"SHOT_SECTIONS",0,["executive","reach","views","engagement","visits","audience","top_content"]])}]);