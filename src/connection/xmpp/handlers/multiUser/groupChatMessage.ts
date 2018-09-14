//import {} from '../handler'
import * as NS from '../../namespace'
import Log from '../../../../util/Log'
import JID from '../../../../JID'
import Message from '../../../../Message'
import Utils from '../../../../util/Utils'
import Translation from '../../../../util/Translation'
import Client from '../../../../Client'
import Contact from '../../../../Contact'
import MultiUserContact from '../../../../MultiUserContact'
import Notification from '../../../../Notification'
import {SOUNDS} from '../../../../CONST'
import Pipe from '../../../../util/Pipe'
import AbstractHandler from '../../AbstractHandler'

// body.replace(/^\/me /, '<i title="/me">' + Utils.removeHTML(this.sender.getName()) + '</i> ');

export default class extends AbstractHandler {
   public processStanza(stanza:Element) {
      let messageId = stanza.getAttribute('id');

      let messageElement = $(stanza);
      let from = new JID(stanza.getAttribute('from'));
      let subjectElement = messageElement.find('subject');
      let bodyElement = messageElement.find('body:first');
      let body = bodyElement.text();
      let nickname = from.resource;

      let contact = <MultiUserContact> this.account.getContact(from);
      if (typeof contact === 'undefined') {
         Log.info('Sender is not in our contact list')

         return this.PRESERVE_HANDLER;
      }

      if (contact.getType() !== 'groupchat') {
         Log.info('This groupchat message is not intended for a MultiUserContact');

         return this.PRESERVE_HANDLER;
      }

      if(subjectElement.length === 1 && bodyElement.length === 0) {
         contact.setSubject(subjectElement.text());

         let translatedMessage = Translation.t('changed_subject_to', {
            nickname: nickname,
            subject: contact.getSubject()
         });

         contact.getChatWindow().addSystemMessage(translatedMessage);

         return this.PRESERVE_HANDLER;
      }

      if (body !== '') {
         let delay = messageElement.find('delay[xmlns="urn:xmpp:delay"]');
         let sendDate = (delay.length > 0) ? new Date(delay.attr('stamp')) : new Date();

         if (contact.getNickname() === nickname) {
            //@TODO only after room was created (history)
            Log.debug('Ignore my own groupchat messages');

            return this.PRESERVE_HANDLER;
         }

         let message = new Message({
            peer: from,
            direction: Message.DIRECTION.IN,
            plaintextMessage: body,
            // htmlMessage: htmlBody.html(),
            stamp: sendDate.getTime(),
            sender: {
               name: nickname
            }
         });

         let pipe = Pipe.get('afterReceiveGroupMessage');

         pipe.run(contact, message).then(([contact, message]) => {
            //@REVIEW why is this required at this position
            message.save();

            let chatWindow = contact.openChatWindow();
            chatWindow.receiveIncomingMessage(message);
         });
      }

      // var subjectElement = messageElement.find('subject');
      //
      // if (subjectElement.length > 0) {
      //    var roomdata = jsxc.storage.getUserItem('buddy', room);
      //
      //    roomdata.subject = subjectElement.text();
      //
      //    jsxc.storage.setUserItem('buddy', room, roomdata);
      //
      //    jsxc.gui.window.postMessage({
      //       bid: room,
      //       direction: jsxc.Message.SYS,
      //       msg: $.t('changed_subject_to', {
      //          nickname: nickname,
      //          subject: roomdata.subject
      //       })
      //    });
      // }

      return this.PRESERVE_HANDLER;
   }
}
