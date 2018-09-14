import Contact from './Contact'
import Translation from './util/Translation'
import Client from './Client'
import * as CONST from './CONST'
import { FUNCTION as NOTICEFUNCTION } from './Notice'
import openConfirmDialog from './ui/dialogs/confirm'
import Overlay from './ui/Overlay'
import Hash from './util/Hash'
import Log from './util/Log'
import defaultIconFile = require('../images/XMPP_logo.png')
import { Presence } from 'connection/AbstractConnection';

interface NotificationSettings {
   title: string,
   message: string,
   duration?: number,
   force?: boolean,
   soundFile?: string,
   loop?: boolean,
   source?: Contact,
   icon?: string
};

const enum NotificationState {
   DISABLED,
   ENABLED,
   ASK
};

let NotificationAPI = (<any>window).Notification;

export default class Notification {
   private static inited = false;

   private static popupTimeout;

   private static popupDelay = 1000;

   private static audioObject;

   public static askForPermission() {
      let overlay = new Overlay();
      openConfirmDialog(Translation.t('Should_we_notify_you_')).getPromise().then(() => {
         overlay.open();

         return this.requestPermission();
      }).then(() => {
         Client.getStorage().setItem('notificationState', NotificationState.ENABLED);
      }).catch(() => {
         Client.getStorage().setItem('notificationState', NotificationState.DISABLED);
      }).then(() => {
         overlay.close();
      });
   }

   public static muteSound(external?) {
      $('#jsxc-menu .jsxc-muteNotification').text(Translation.t('Unmute'));

      if (external !== true) {
         Client.setOption('muteNotification', true);
      }
   }

   public static unmuteSound(external?) {
      $('#jsxc-menu .jsxc-muteNotification').text(Translation.t('Mute'));

      if (external !== true) {
         Client.setOption('muteNotification', false); // notifications disabled
      }
   }

   public static async notify(settings: NotificationSettings) {
      if (!Client.getOption('notification')) {
         Log.debug('Drop notification, because notifications are disabled.');

         return; // notifications disabled
      }

      let state = Client.getStorage().getItem('notificationState');
      state = (typeof state === 'number') ? state : NotificationState.ASK;

      if (state === NotificationState.ASK && !Notification.hasPermission()) {
         Client.getNoticeManager().addNotice({
            title: Translation.t('Notifications') + '?',
            description: Translation.t('Should_we_notify_you_'),
            fnName: NOTICEFUNCTION.notificationRequest
         });
      }

      if (!Notification.hasPermission()) {
         Log.debug('Drop notification, because I have no permission');

         return;
      }

      if (Client.isVisible() && !settings.force) {
         Log.debug('Drop notification, because client is visible.');

         return;
      }

      settings.icon = settings.icon || <string><any>defaultIconFile;

      if (settings.source) {
         let avatar;

         try {
            avatar = await settings.source.getAvatar();
         } catch (err) { }


         if (avatar && avatar.src) {
            settings.icon = avatar.src;
         } else {
            var hash = Hash.String(settings.source.getName());

            var hue = Math.abs(hash) % 360;
            var saturation = 90;
            var lightness = 65;

            let canvas = <HTMLCanvasElement>$('<canvas>').get(0);
            canvas.height = 100;
            canvas.width = 100;

            let ctx = canvas.getContext('2d');

            ctx.fillStyle = 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
            ctx.fillRect(0, 0, 100, 100);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 50px sans-serif';
            ctx.fillText(settings.source.getName()[0].toUpperCase(), 50, 50);

            settings.icon = canvas.toDataURL('image/jpeg');
         }
      }

      settings.duration = settings.duration || Client.getOption('notification').duration;
      settings.title = settings.title;
      settings.message = settings.message;

      Notification.popupTimeout = setTimeout(function() {
         Notification.showPopup(settings);
      }, Notification.popupDelay);
   }

   private static showPopup(settings: NotificationSettings) {
      if (typeof settings.soundFile === 'string') {
         Notification.playSound(settings.soundFile, settings.loop, settings.force);
      }

      var popup = new NotificationAPI(settings.title, {
         body: settings.message,
         icon: settings.icon
      });

      if (settings.duration > 0) {
         setTimeout(function() {
            popup.close();
         }, settings.duration);
      }
   }

   private static hasSupport() {
      return !!NotificationAPI;
   }

   private static requestPermission() {
      return new Promise((resolve, reject) => {
         NotificationAPI.requestPermission(function(status) {
            if (NotificationAPI.permission !== status) {
               NotificationAPI.permission = status;
            }

            if (Notification.hasPermission()) {
               resolve();
            } else {
               reject();
            }
         });
      });
   }

   private static hasPermission() {
      return NotificationAPI.permission === CONST.NOTIFICATION_GRANTED;
   }

   private static playSound(soundFile: string, loop?: boolean, force?: boolean) {
      if (Client.getOption('muteNotification') || Client.getPresenceController().getCurrentPresence() === Presence.dnd) {
         Log.debug('Sound is muted or presence is DND');

         return;
      }

      if (Client.isVisible() && !force) {
         return;
      }

      Notification.stopSound();

      var audio = new Audio(soundFile);
      audio.loop = loop || false;
      audio.play();

      Notification.audioObject = audio;
   }

   private static stopSound() {
      var audio = Notification.audioObject;

      if (typeof audio !== 'undefined' && audio !== null) {
         audio.pause();
         Notification.audioObject = null;
      }
   }
}
