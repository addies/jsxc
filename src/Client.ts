import { IPlugin } from './plugin/AbstractPlugin'
import Storage from './Storage'
import { NoticeManager } from './NoticeManager'
import PluginRepository from './plugin/PluginRepository'
import Log from './util/Log'
import Options from './Options'
import PresenceController from './PresenceController'
import PageVisibility from './PageVisibility'
import ChatWindowList from './ui/ChatWindowList';
import AccountManager from './AccountManager';

export default class Client {
   private static storage;

   private static accounts = {};

   private static noticeManager;

   private static presenceController: PresenceController;

   private static accountManager: AccountManager;

   private static initialized = false;

   public static init(options?): number {
      if (Client.initialized) {
         return;
      }

      Client.initialized = true;

      PageVisibility.init();

      let storage = Client.getStorage();

      if (typeof options === 'object' && options !== null) {
         Options.get().overwriteDefaults(options);
      }

      Client.accountManager = new AccountManager(storage);
      Client.presenceController = new PresenceController(storage, () => Client.accountManager.getAccounts());
      Client.noticeManager = new NoticeManager(storage);

      return Client.accountManager.restoreAccounts();
   }

   public static getVersion(): string {
      return '4.0.0';
   }

   public static addPlugin(Plugin: IPlugin) {
      try {
         PluginRepository.add(Plugin);
      } catch (err) {
         Log.warn('Error while adding Plugin: ' + err);
      }
   }

   public static hasTabFocus() {
      let hasFocus = true;

      if (typeof document.hasFocus === 'function') {
         hasFocus = document.hasFocus();
      }

      return hasFocus;
   }

   public static isVisible() {
      return PageVisibility.isVisible();
   }

   public static isExtraSmallDevice(): boolean {
      return $(window).width() < 500;
   }

   public static isDebugMode(): boolean {
      return Client.getStorage().getItem('debug') === true;
   }

   public static getStorage(): Storage {
      if (!Client.storage) {
         Client.storage = new Storage();
      }

      return Client.storage;
   }

   public static getAccountManager(): AccountManager {
      return Client.accountManager;
   }

   public static getNoticeManager(): NoticeManager {
      return Client.noticeManager;
   }

   public static getPresenceController(): PresenceController {
      return Client.presenceController;
   }

   public static getChatWindowList(): ChatWindowList {
      return ChatWindowList.get();
   }

   public static getOptions(): Options {
      return Options.get();
   }

   public static getOption(key: string) {
      return Client.getOptions().get(key);
   }

   public static setOption(key: string, value) {
      Client.getOptions().set(key, value);
   }
}
