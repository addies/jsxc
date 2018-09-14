import Message from '../Message'
import JID from '../JID'
import * as NS from './xmpp/namespace'
import RosterHandler from './xmpp/handlers/roster'
import Log from '../util/Log'
import * as StropheLib from 'strophe.js'
import JingleHandler from './JingleHandler'
import {IConnection} from './ConnectionInterface'
import Account from '../Account'
import Pipe from '../util/Pipe'
import Form from './Form'

let Strophe = StropheLib.Strophe;
let $iq = StropheLib.$iq;
let $msg = StropheLib.$msg;
let $pres = StropheLib.$pres;

enum Presence {
   online,
   chat,
   away,
   xa,
   dnd,
   offline
}

abstract class AbstractConnection {
   protected abstract connection;

   protected abstract send(stanzaElement:Element);
   protected abstract send(stanzaElement:Strophe.Builder);

   protected abstract sendIQ(stanzaElement:Element):Promise<{}>;
   protected abstract sendIQ(stanzaElement:Strophe.Builder):Promise<{}>;

   public abstract registerHandler(handler:(stanza:string)=>boolean, ns?:string, name?:string, type?:string, id?:string, from?:string);

   protected jingleHandler;
   public abstract getJingleHandler();

   protected node = 'https://jsxc.org';

   constructor(protected account:Account) {

      let discoInfo = this.account.getDiscoInfo();

      discoInfo.addIdentity('client', 'web', 'JSXC');
   }

   public getJID():JID {
      return this.account.getJID();
   }

   public getRoster() {
      let iq = $iq({
         type: 'get'
      }).c('query', {
         xmlns: 'jabber:iq:roster'
      });

      //@TODO use account.getStorage().getItem('roster', 'version'), maybe better as parameter

      return this.sendIQ(iq).then((stanza:Element) => {
         let rosterHandler = new RosterHandler(this.account);
         return rosterHandler.processStanza(stanza);
      });
   }

   public sendMessage(message:Message) {
      if (message.getDirection() !== Message.DIRECTION.OUT) {
         return;
      }

      let xmlMsg = $msg({
         to: message.getPeer().full,
         type: message.getType(),
         id: message.getId()
      });

      let htmlMessage;

      //@TODO html and plaintext is the same -> dry
      if (message.isEncrypted() && message.getEncryptedHtmlMessage()) {
         htmlMessage = message.getEncryptedHtmlMessage();
      } else if (message.getHtmlMessage()) {
         if (!message.isEncrypted()) {
            htmlMessage = message.getHtmlMessage();
         } else {
            Log.warn('This Html message should be encrypted');
         }
      }

      if (htmlMessage) {
         xmlMsg.c('html', {
            xmlns: Strophe.NS.XHTML_IM
         }).c('body', {
            xmlns: Strophe.NS.XHTML
         }).h(htmlMessage).up();
      }

      let plaintextMessage;

      if (message.isEncrypted() && message.getEncryptedPlaintextMessage()) {
         plaintextMessage = message.getEncryptedPlaintextMessage();
      } else if (message.getPlaintextMessage()) {
         if (!message.isEncrypted()) {
            plaintextMessage = message.getPlaintextMessage();
         } else {
            Log.warn('This plaintext message should be encrypted');
         }
      }

      if (plaintextMessage) {
         xmlMsg.c('body').t(plaintextMessage).up();
      }

      let pipe = Pipe.get('preSendMessageStanza');
      pipe.run(message, xmlMsg).then(([message, xmlMsg]) => {
         this.send(xmlMsg);
      });
   }

   public sendPresence(presence?:Presence) {
      var presenceStanza = $pres();

      presenceStanza.c('c', this.generateCapsAttributes()).up();

      if (typeof presence !== 'undefined' && presence !== Presence.online) {
         presenceStanza.c('show').t(Presence[presence]).up();
      }

      // var priority = Options.get('priority');
      // if (priority && typeof priority[status] !== 'undefined' && parseInt(priority[status]) !== 0) {
      //    presenceStanza.c('priority').t(priority[status]).up();
      // }

      Log.debug('Send presence', presenceStanza.toString());

      this.send(presenceStanza);
   }

   public removeContact(jid:JID) {
      let self = this;

      // Shortcut to remove buddy from roster and cancle all subscriptions
      let iq = $iq({
         type: 'set'
      }).c('query', {
         xmlns: NS.get('ROSTER')
      }).c('item', {
         jid: jid.bare,
         subscription: 'remove'
      });

      return this.sendIQ(iq);
   }

   public addContact(jid:JID, alias:string) {
      let waitForRoster = this.addContactToRoster(jid, alias);

      this.sendSubscriptionRequest(jid);

      return waitForRoster;
   };

   public loadVcard(jid:JID) {
      let iq = $iq({
         type: 'get',
         to: jid.full
      }).c('vCard', {
         xmlns: NS.get('VCARD')
      });

      //@TODO register Namespace 'VCARD', 'vcard-temp'

      return this.sendIQ(iq).then(this.parseVcard);
   }

   public getAvatar(jid:JID) {
      return this.loadVcard(jid).then(function(vcard) {
         return new Promise(function(resolve, reject){
            if (vcard.PHOTO && vcard.PHOTO.src) {
               resolve(vcard.PHOTO);
            } else {
               reject();
            }
         });
      });
   }

   public setDisplayName(jid:JID, displayName:string) {
      var iq = $iq({
         type: 'set'
      }).c('query', {
         xmlns: 'jabber:iq:roster'
      }).c('item', {
         jid: jid.bare,
         name: displayName
      });

      this.sendIQ(iq);
   }

   public sendSubscriptionAnswer(to:JID, accept:boolean) {
      let presenceStanza = $pres({
         to: to.bare,
         type: (accept) ? 'subscribed' : 'unsubscribed'
      });

      this.send(presenceStanza);
   }

   public getDiscoInfo(jid:JID, node?:string):Promise<any> {
      let attrs = {
        xmlns: NS.get('DISCO_INFO'),
        node: null
      };

      if (typeof node === 'string' && node.length > 0) {
        attrs.node = node;
      }

      let iq = $iq({
        to: jid.full,
        type: 'get'
      }).c('query', attrs);

      return this.sendIQ(iq);
   }

   public getDiscoItems(jid:JID, node?:string):Promise<any> {
     let attrs = {
       xmlns: NS.get('DISCO_ITEMS'),
       node: null
     };

     if (typeof node === 'string' && node.length > 0) {
       attrs.node = node;
     }

     let iq = $iq({
       to: jid.full,
       type: 'get'
     }).c('query', attrs);

     return this.sendIQ(iq);
   }

   public joinMultiUserRoom(jid:JID, password?:string) {
      if (jid.isBare()) {
         return Promise.reject('We need a full jid to join a room');
      }

      let pres = $pres({
         to: jid.full
      }).c('x', {
         xmlns: Strophe.NS.MUC
      });

      if (password) {
         pres.c('password').t(password).up();
      }

      return this.send(pres);
   }

   public leaveMultiUserRoom(jid:JID, exitMessage?:string) {
      let pres = $pres({
        type: 'unavailable',
      //   id: presenceid,
        to: jid.full
      });

      if (exitMessage) {
        pres.c('status', exitMessage);
      }

      return this.send(pres);
   }

   public destroyMultiUserRoom(jid:JID) {
      let iq = $iq({
         to: jid.bare,
         type: 'set'
      }).c('query', {
         xmlns: 'http://jabber.org/protocol/muc#owner' //@TODO use namespace object
      }).c('destroy');

      return this.sendIQ(iq);
   }

   public createInstantRoom(jid:JID) {
      let iq = $iq({
         to: jid.bare,
         type: 'set'
      }).c('query', {
         xmlns: 'http://jabber.org/protocol/muc#owner'
      }).c('x', {
         xmlns: 'jabber:x:data',
         type: 'submit'
      });

      return this.sendIQ(iq);
   }

   public getRoomConfigurationForm(jid:JID) {
      let iq = $iq({
         to: jid.bare,
         type: 'get'
      }).c('query', {
         xmlns: 'http://jabber.org/protocol/muc#owner'
      });

      return this.sendIQ(iq);
   }

   public submitRoomConfiguration(jid:JID, form:Form) {
      let iq = $iq({
         to: jid.bare,
         type: 'set'
      }).c('query', {
         xmlns: 'http://jabber.org/protocol/muc#owner'
      }).cnode(form.toXML());

      return this.sendIQ(iq);
   }

   public cancelRoomConfiguration(jid:JID) {
      let iq = $iq({
         to: jid.bare,
         type: 'set'
      }).c('query', {
         xmlns: 'http://jabber.org/protocol/muc#owner'
      }).c('x', {
         xmlns: 'jabber:x:data',
         type: 'cancel'
      });

      return this.sendIQ(iq);
   }

   public close() {

   }

   private addContactToRoster(jid:JID, alias:string) {
      let iq = $iq({
         type: 'set'
      }).c('query', {
         xmlns: 'jabber:iq:roster'
      }).c('item', {
         jid: jid.full,
         name: alias || ''
      });

      return this.sendIQ(iq);
   }

   private sendSubscriptionRequest(jid:JID) {
      // send subscription request to buddy (trigger onRosterChanged)
      this.send($pres({
         to: jid.full,
         type: 'subscribe'
      }));
   }

   private parseVcard = (stanza) => {
      let data:any = {};
      let vcard = $(stanza).find('vCard');

      if (!vcard.length) {
         return data;
      }

      return this.parseVcardChildren(vcard);
   }

   private parseVcardChildren(stanza) {
      let data:any = {};
      let children = stanza.children();

      children.each(function(){
         let item = $(this);
         let children = item.children();
         let itemName = item[0].tagName;
         let value = null;

         if (itemName === 'PHOTO') {
            let img = item.find('BINVAL').text();
            let type = item.find('TYPE').text();
            let src = 'data:' + type + ';base64,' + img;

            if (item.find('EXTVAL').length > 0) {
               src = item.find('EXTVAL').text();
            }

            // concat chunks
            src = src.replace(/[\t\r\n\f]/gi, '');

            value = {
               type: type,
               src: src
            };
         } else if (children.length > 0) {
            value = this.parseVcardChildren(children);
         } else {
            value = item.text();
         }

         data[itemName] = value;
      });

      return data;
   }

   private generateCapsAttributes() { console.log(this.account.getDiscoInfo())
     return {
       'xmlns': NS.get('CAPS'),
       'hash': 'sha-1',
       'node': this.node,
       'ver': this.account.getDiscoInfo().getCapsVersion()
     }
   }
}

export {AbstractConnection, Presence};
