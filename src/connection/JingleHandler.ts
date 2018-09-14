import { IConnection } from './Connection.interface'
import Account from '../Account'
import * as JSM from 'jingle'
import * as RTC from 'webrtc-adapter'
import { createRegistry } from 'jxt'
import Log from '../util/Log'
import Translation from '../util/Translation'
import Notification from '../Notification'
import JID from '../JID'
import { VideoDialog } from '../ui/VideoDialog'
import JingleSession from '../JingleSession'
import JingleAbstractSession from '../JingleAbstractSession'

let jxt = createRegistry();
jxt.use(require('jxt-xmpp-types'));
jxt.use(require('jxt-xmpp'));

let IqStanza = jxt.getDefinition('iq', 'jabber:client');

export default class JingleHandler {

   protected manager: JSM;

   protected static videoDialog;

   protected static instances = [];

   constructor(protected account: Account, protected connection: IConnection) {

      this.manager = new JSM({
         peerConnectionConstraints: this.getPeerConstraints(),
         jid: connection.getJID().full,
         selfID: connection.getJID().full
      });

      this.manager.on('change:connectionState', function() {
         console.log('ice', arguments);
      })

      this.manager.on('log:*', function(level, msg) {
         Log.debug('[JINGLE][' + level + ']', msg);
      });

      this.manager.on('send', (data) => {
         var iq = new IqStanza(data);
         var iqElement = $.parseXML(iq.toString()).getElementsByTagName('iq')[0];

         //@TODO add id to iq
         (<any>this.connection).send(iqElement); //@REVIEW
      });

      this.manager.on('incoming', (session) => {
         this.onIncoming(session);
      });

      JingleHandler.instances.push(this);

      //@TODO add on client unavilable (this.manager.endPeerSessions(peer_jid_full, true))
   }

   public initiate(peerJID: JID, stream, offerOptions?) {
      var session = this.manager.createMediaSession(peerJID.full);

      //@TODO extract onIceConnectionStateChanged from VideoWindow and use here

      session.addStream(stream);
      session.start(offerOptions);

      return session;
   }

   public terminate(jid, reason?, silent?);
   public terminate(reason?, silent?);
   public terminate() {
      if (arguments.length === 3) {
         this.manager.endPeerSessions(arguments[0], arguments[1], arguments[2]);
      } else {
         this.manager.endAllSessions(arguments[0], arguments[1]);
      }
   }

   //@TODO add ice server interface
   public addICEServer(server) {
      this.manager.addICEServer(server);
   }

   public setICEServers(servers) {
      this.manager.iceServers = servers;
   }

   public setPeerConstraints(constraints) {
      this.manager.config.peerConnectionConstraints = constraints;
   }

   public onJingle = (iq) => {
      var req;

      try {
         req = jxt.parse(iq.outerHTML);
      } catch (err) {
         Log.error('Error while parsing jingle: ', err);
         //@TODO abort call
         return;
      }

      this.manager.process(req.toJSON());

      return true;
   }

   protected onIncoming(session): JingleAbstractSession {
      return JingleSession.create(this.account, session);
   }

   private onIncomingFileTransfer(session) {
      Log.debug('incoming file transfer from ' + session.peerID);

      let peerJID = new JID(session.peerID);
      let contact = this.account.getContact(peerJID);

      if (!contact) {
         Log.warn('Reject file transfer, because the contact is not in your contact list');

         return;
      }

      session.accept();

      let chatWindow = contact.openChatWindow();

      // let message = new Message({
      //    peer: contact.getJid(),
      //    direction: Message.DIRECTION.IN,
      //    attachment: new Attachment({
      //       name: session.receiver.metadata.name,
      //       type: session.receiver.metadata.type || 'application/octet-stream'
      //    })
      // });
      // message.save();

      // chatWindow.receiveIncomingMessage(message);
      //
      // session.receiver.on('progress', function(sent, size) {
      //    message.updateProgress(sent, size);
      // });
   }

   private onIncomingStream(session) {
      Log.debug('incoming stream from ' + session.peerID);

      session.chatWindow.postScreenMessage(Translation.t('Incoming_stream'), session.sid);

      Notification.notify({
         title: Translation.t('Incoming_stream'),
         message: Translation.t('from_sender') + session.peerContact.getName(),
         source: session.peerContact
      });

      // send signal to partner
      session.ring();

      let videoWindow = new VideoDialog();
      videoWindow.addSession(session);

      videoWindow.showCallDialog(session).then(() => {
         session.accept();
      }).catch(() => {
         session.decline();
      });
   }

   private getPeerConstraints() {
      var browserDetails = RTC.browserDetails;
      let peerConstraints;

      if ((browserDetails.version < 33 && browserDetails.browser === 'firefox') || browserDetails.browser === 'chrome') {
         peerConstraints = {
            mandatory: {
               'OfferToReceiveAudio': true,
               'OfferToReceiveVideo': true
            }
         };

         if (browserDetails.browser === 'firefox') {
            peerConstraints.mandatory.MozDontOfferDataChannel = true;
         }
      } else {
         peerConstraints = {
            'offerToReceiveAudio': true,
            'offerToReceiveVideo': true
         };

         if (browserDetails.browser === 'firefox') {
            peerConstraints.mozDontOfferDataChannel = true;
         }
      }

      return peerConstraints;
   }

   public static terminateAll(reason?: string) {
      JingleHandler.instances.forEach((instance) => {
         instance.terminate(reason);
      });
   }

   public static getVideoDialog(): VideoDialog {
      if (!JingleHandler.videoDialog || !JingleHandler.videoDialog.isReady()) {
         JingleHandler.videoDialog = new VideoDialog();
      }

      return JingleHandler.videoDialog;
   }
}




/** required disco features for video call */
// reqVideoFeatures: ['urn:xmpp:jingle:apps:rtp:video', 'urn:xmpp:jingle:apps:rtp:audio', 'urn:xmpp:jingle:transports:ice-udp:1', 'urn:xmpp:jingle:apps:dtls:0'],

/** required disco features for file transfer */
// reqFileFeatures: ['urn:xmpp:jingle:1', 'urn:xmpp:jingle:apps:file-transfer:3'],
