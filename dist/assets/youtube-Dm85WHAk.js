import{c as u}from"./index-Bb5KpGkJ.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],i=u("Globe",l);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=[["path",{d:"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",key:"j76jl0"}],["path",{d:"M22 10v6",key:"1lu8f3"}],["path",{d:"M6 12.5V16a6 3 0 0 0 12 0v-3.5",key:"1r8lef"}]],s=u("GraduationCap",c);function o(e){if(!e)return null;try{const t=new URL(e),n=t.hostname.replace(/^www\./,"");if(n==="youtu.be")return t.pathname.slice(1).split("/")[0]||null;if(n!=="youtube.com"&&n!=="m.youtube.com")return null;if(t.pathname==="/watch")return t.searchParams.get("v");const a=t.pathname.split("/").filter(Boolean);return["embed","shorts","live","v"].includes(a[0])&&a[1]||null}catch{return null}}function p(e){const t=o(e);return t?`https://www.youtube.com/embed/${t}`:null}function h(e,t="hqdefault"){const n=o(e);return n?`https://i.ytimg.com/vi/${n}/${t}.jpg`:null}export{s as G,i as a,o as b,p as c,h as g};
