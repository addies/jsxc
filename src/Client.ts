import Account from './Account'
import Message from './Message'
import { AbstractPlugin, IPlugin } from './plugin/AbstractPlugin'
import Storage from './Storage';
import * as UI from './ui/web'
import JID from './JID'
import Roster from './ui/Roster'
import ChatWindowList from './ui/ChatWindowList'
import RoleAllocator from './RoleAllocator'
import SortedPersistentMap from './util/SortedPersistentMap'
import { NoticeManager } from './NoticeManager'
import PluginRepository from './plugin/PluginRepository'
import Log from './util/Log'
import Options from './Options'
import PresenceController from './PresenceController'

export default class Client {
   private static storage;

   private static accounts = {};

   private static noticeManager;

   private static presenceController: PresenceController;

   public static init(options?): number {
      let roleAllocator = RoleAllocator.get();
      let storage = Client.getStorage();
      let accountIds = storage.getItem('accounts') || [];
      let numberOfAccounts = accountIds.length;

      if (typeof options === 'object' && options !== null) {
         Options.get().overwriteDefaults(options);
      }

      Client.presenceController = new PresenceController(storage, Client.getAccounts);
      Client.noticeManager = new NoticeManager(Client.getStorage());

      accountIds.forEach(function(id) {
         let account = Client.accounts[id] = new Account(id);

         Client.presenceController.registerAccount(account);

         roleAllocator.waitUntilMaster().then(function() {
            return account.connect();
         }).then(function() {

         }).catch(function(msg) {
            Client.accounts[id].remove();

            console.warn(msg)
         });
      });

      return numberOfAccounts;
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

   public static hasFocus() {

   }

   public static isExtraSmallDevice(): boolean {
      return $(window).width() < 500;
   }

   public static isDebugMode(): boolean {
      return Client.getStorage().getItem('debug') === true;
   }

   public static getStorage() {
      if (!Client.storage) {
         Client.storage = new Storage();
      }

      return Client.storage;
   }

   public static getNoticeManager(): NoticeManager {
      return Client.noticeManager;
   }

   public static getPresenceController(): PresenceController {
      return Client.presenceController;
   }

   public static getAccount(jid: JID): Account;
   public static getAccount(uid?: string): Account;
   public static getAccount() {
      let uid;

      if (arguments[0] instanceof JID) {
         uid = arguments[0].bare;
      } else if (arguments[0]) {
         uid = arguments[0];
      } else {
         uid = Object.keys(Client.accounts)[0];
      }
      console.log('accounts', Client.accounts);
      return Client.accounts[uid];
   }

   public static getAccounts(): Array<Account> {
      // @REVIEW use of Object.values()
      let accounts = [];

      for (let id in Client.accounts) {
         accounts.push(Client.accounts[id]);
      }

      return accounts;
   }

   public static createAccount(boshUrl: string, jid: string, sid: string, rid: string);
   public static createAccount(boshUrl: string, jid: string, password: string);
   public static createAccount() {
      let account;

      if (Client.getAccount(arguments[1])) {
         return Promise.reject('Account with this jid already exists.');
      } else if (arguments.length === 4) {
         account = new Account(arguments[0], arguments[1], arguments[2], arguments[3]);
      } else if (arguments.length === 3) {
         account = new Account(arguments[0], arguments[1], arguments[2]);
      } else {
         return Promise.reject('Wrong number of arguments');
      }

      Client.addAccount(account);

      return Promise.resolve(account);
   }

   public static removeAccount(account: Account) {
      delete Client.accounts[account.getUid()];

      Client.save();

      if (Object.keys(Client.accounts).length === 0) {
         Roster.get().setNoConnection();
      }
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

   private static addAccount(account: Account) {
      Client.accounts[account.getUid()] = account;

      Client.presenceController.registerAccount(account);

      Client.save()
   }

   private static save() {
      Client.getStorage().setItem('accounts', Object.keys(Client.accounts));
   }

   private static forEachAccount(callback: (account: Account) => void) {
      for (let id in Client.accounts) {
         callback(Client.accounts[id]);
      }
   }
}
