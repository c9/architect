//////////////////////////////////////
//                                  //
// JS domBuilder Library            //
//                                  //
// Tim Caswell <tim@creationix.com> //
//                                  //
//////////////////////////////////////
(function(){function f(a){return a.substr(1)}function b(a,b){var c=Object.keys(b);for(var d=0,e=c.length;d<e;d++){var f=c[d];a[f]=b[f]}}function a(a,c){var d=Object.keys(c);for(var e=0,f=d.length;e<f;e++){var g=d[e],h=c[g];g==="$"?h(a):g==="css"?b(a.style,h):g.substr(0,2)==="on"?a.addEventListener(g.substr(2),h,!1):a.setAttribute(g,h)}}this.domBuilder=function g(b,h){if(typeof b=="string")return document.createTextNode(b);var i,j;for(var k=0,l=b.length;k<l;k++){var m=b[k];if(!i){if(typeof m=="string"){var n=m.match(TAG_MATCH);n=n?n[0]:"div",i=document.createElement(n),j=!0;var o=m.match(c);o&&i.setAttribute("class",o.map(f).join(" "));var p=m.match(d);p&&i.setAttribute("id",p[0].substr(1));var q=m.match(e);h&&q&&(h[q[0].substr(1)]=i);continue}i=document.createDocumentFragment()}j&&typeof m=="object"&&m.__proto__===Object.prototype?a(i,m):i.appendChild(g(m,h)),j=!1}return i};var c=/\.[^.#$]+/g,d=/#[^.#$]+/,e=/\$[^.#$]+/;TAG_MATCH=/^[^.#$]+/})()