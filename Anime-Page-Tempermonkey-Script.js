// ==UserScript==
// @name         Telegram new episode finder for MAL anime page
// @namespace    http://tampermonkey.net/
// @version      1.26
// @description  Find new unwatched episode from your disired Telegram channel/group/peer... and show a link to it in front of each anime page title.
// @author       KingOfNull
// @match        https://myanimelist.net/anime/*/*
// @icon         https://www.google.com/s2/favicons?domain=myanimelist.net
// @grant        GM_addStyle
// @license MIT
// @ require      -

// ==/UserScript==








GM_addStyle(`
.new-ep-link{
 background: #a70000;
 color: white !important;
 padding: 5px 7px;
 border-radius: 7px;
 display:inline-block;
 padding:5px;
 margin: 0.5em 0;
}

a.new-ep-link:hover {
    color: #a70000 !important;
    background: white !important;
}

.rename-btn {
    background: #009688;
    padding: 0.2em 0.4em;
    border-radius: 0.5em;
    color: white !important;
    position: relative;
    top: -7px;
    cursor: pointer;
    margin: 1em 0.5em;
}

.list-table .list-table-data .data a.rename-btn:hover {
    background: #ffffff !important;
    color:  #009688 !important;
}

a.new-ep-link, a.rename-btn {
    font-size: 10px !important;
    font-family: monospace !important;
}

`);

function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');

    s.setAttribute('src', src);
    s.addEventListener('load', resolve);
    s.addEventListener('error', reject);

    document.body.appendChild(s);
  });
}

(async ()=> {
    'use strict';

    await addScript('https://cdn.jsdelivr.net/gh/kingofnull/gramjs-browser-build@69e9b471e30bb6da54577f911c953e1bf646b98b/gramjs.js');


    const {Api, TelegramClient} = gramjs;
    const { StringSession } = gramjs.sessions;

    //you can use mine or generate your own one
    const apiId = 1799740; // put your api id here [for example 123456789]
    const apiHash = "645175d3249752aa32bce7b4659cfd94"; // put your api hash here [for example '123456abcfghe']


    const session = localStorage.getItem('TgStrSession') ?? "";


    const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
        connectionRetries: 3,
    });

    client.session.setDC(4, 'kws4.web.telegram.org', 443);//wss://kws4.web.telegram.org/apiws


    async function findNewEp(name,ep,peerId,withOutLeadingZero){
        let nextEpStr=(ep*1+1).toString();
        if(!withOutLeadingZero){
            nextEpStr=nextEpStr.padStart(2,'0');
        }

        let searchTerm=`"${name} ${nextEpStr}"`;
        console.log("search for:",searchTerm);
        const result = await client.invoke(
            new Api.messages.Search({
                peer: peerId,
                q: searchTerm,
                filter: new Api.InputMessagesFilterDocument({}),
                limit:10,
            })
        );

        if(result.count<1){
            console.warn("not found");
            if(!withOutLeadingZero){
                return findNewEp(name,ep,peerId,true);
            }
            return null;
        }

        let message=result.messages.at(0);
        let fname=message.media.document.attributes.at().fileName;
        console.log(result.count,fname); // prints the result
        /*
        const linkResult = await client.invoke(
            new Api.channels.ExportMessageLink({
                channel: peerId,
                id: message.id,
                thread: true,
            })
        );
        let link=linkResult.link;
*/
        let link=`tg://privatepost?channel=${message.peerId.channelId}&post=${message.id}`;
        console.log(link);
        return {link,fname};
    }


    function initRenamer($title){
        const orgName= $title.text();
        const renameKey="acname-"+orgName;


        const customName=localStorage.getItem(renameKey);
        if(customName){
            $title.text(customName);
        }

        $title.siblings(".rename-btn").remove();
        $("<a>",{class:'rename-btn'}).text("Rename").insertAfter($title).click(e=> {
            let newname=prompt("Enter new name:",$title.text());
            if(newname===""){
                localStorage.removeItem(renameKey);
                $title.text(orgName);
            }else if(newname!==null){
                localStorage.setItem(renameKey,newname);
                $title.text(newname);
            }
        });

        return $title.text();
    }



    //find your peerId using @username_to_id_bot in telegram
    let peerId=localStorage.getItem("TgSearchPeerId");
    if(!peerId){
        peerId=prompt("Enter your search target peerId:");
        localStorage.setItem("TgSearchPeerId",peerId);
    }

    if(!!Number(peerId)){
        peerId=Number(peerId);
    }



    async function fetchDlLink(curEp){
        $('#next-ep-link').remove();

        let $r=$(".title-name").first();
        let title=$r.text();
        //let curEp=$("#myinfo_watchedeps").val() ?? "0";
        curEp=curEp ?? "0";
        if(!Number(curEp)){
            curEp="0";
        }

        title=initRenamer($r);

        console.log(title,":",curEp);

        //await client.connect();
        await client.start({
            phoneNumber: async () => prompt("Please enter your number: "),
            password: async () => prompt("Please enter your password: "),
            phoneCode: async () => prompt("Please enter the code you received: "),
            onError: (err) => console.log(err),
        });
        localStorage.setItem('TgStrSession',client.session.save());

        let data;
        for(let pId of peerId.split(",")){
            try{
                data=await findNewEp(title,curEp,pId*1);
            }catch(e){
                console.error(e);
            }

            if(data){
                break;
            }
        }


        client.disconnect();

        if(data){
            $("<a>",{href:data.link,class:'new-ep-link',target:"tgLinksWin", id:'next-ep-link'})
                .text("New Ep ! : "+data.fname)
                .appendTo($r.parent());
        }


    }


    $(".js-btn-count").on("click", function () {
        fetchDlLink($("#myinfo_watchedeps").val()*1+1);
    });

    $("#myinfo_watchedeps").on('change blure',e=>fetchDlLink($("#myinfo_watchedeps").val()));




    $("#myinfo_watchedeps").trigger('change');


})();