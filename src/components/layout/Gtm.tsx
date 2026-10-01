import Script from "next/script";
import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/consent";

/**
 * Google Tag Manager s Consent Mode v2. ID kontejneru se bere z NEXT_PUBLIC_GTM_ID (GTM-XXXXXXX);
 * bez něj se nic nenačte. Jediný inline skript zaručuje pořadí: výchozí „denied“ → uložený souhlas → teprve pak GTM.
 * Bez souhlasu GTM neukládá žádné analytické ani marketingové cookies. Administrace (/admin) se nesleduje.
 * Záměrně bez <noscript> iframe — bez JavaScriptu nejde souhlas udělit, takže by sledoval bez souhlasu.
 */
export function Gtm() {
  const id = process.env.NEXT_PUBLIC_GTM_ID;
  if (!id || !/^GTM-[A-Z0-9]+$/.test(id)) return null;

  const code = `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var s={ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',personalization_storage:'denied',security_storage:'granted'};
gtag('consent','default',s);
try{
  var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  var c=m&&JSON.parse(decodeURIComponent(m[1]));
  if(c&&c.v===${CONSENT_VERSION}){
    var a=c.a?'granted':'denied',k=c.m?'granted':'denied';
    gtag('consent','update',{ad_storage:k,ad_user_data:k,ad_personalization:k,analytics_storage:a,personalization_storage:k});
  }
}catch(e){}
gtag('set','url_passthrough',true);
if(location.pathname.indexOf('/admin')!==0){
  (function(w,d,t,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  var f=d.getElementsByTagName(t)[0],j=d.createElement(t);j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${id}');
}`;

  return <Script id="gtm" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: code }} />;
}
