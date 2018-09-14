import ChatWindow from './ChatWindow'
import MultiUserContact from '../MultiUserContact'
import Account from '../Account'
import Translation from '../util/Translation'
import JID from '../JID'
import Avatar from './Avatar'

export default class MultiUserChatWindow extends ChatWindow {
   private memberlistElement;

   protected contact:MultiUserContact;

   constructor(account:Account, contact:MultiUserContact) {
      super(account, contact);

      this.disable();
      this.element.addClass('jsxc-groupchat');

      this.addMucElementsToChatWindow();

      this.contact.registerNewMemberHook((value, nickname) => {
         this.addMember(nickname);
      });

      this.contact.registerRemoveMemberHook((nickname) => {
         this.removeMember(nickname);
      });

      for(let nickname of this.contact.getMembers()) {
         this.addMember(nickname);
      }

      this.contact.registerHook('nickname', (newValue, oldValue) => { console.log('nickname changed', oldValue, newValue)
         if (oldValue && !newValue) {
            this.disable();
         } else if(!oldValue && newValue) {
            this.enable();
         }
      });

      this.contact.getNickname() ? this.enable() : this.disable();
   }

   public addMember(nickname, jid?:JID) {
      let memberElement = this.getMemberElementByNickname(nickname);

      if (memberElement.length > 0) {
         return;
      }

      memberElement = $('<li><div class="jsxc-avatar"></div><div class="jsxc-name"/></li>');
      memberElement.attr('data-nickname', nickname);

      this.memberlistElement.find('ul').append(memberElement);

      let title, label;

      if (jid && typeof jid !== 'undefined') {
         label = jid.bare;
         title = title + '\n' + jid.bare;

         //@TODO avatar
      } else {
         label = title = nickname;

         Avatar.setPlaceholder(memberElement.find('.jsxc-avatar'), nickname);
      }

      memberElement.find('.jsxc-name').text(nickname);
      memberElement.attr('title', title);

      this.refreshMemberCount();
   }

   public removeMember(nickname) {
      let m = this.memberlistElement.find('li[data-nickname="' + nickname + '"]');

      if (m.length > 0) {
         m.remove();
      }

      this.refreshMemberCount();
   }

   public emptyMemberList(room) {
      this.memberlistElement.empty();
   }

   private refreshMemberCount() {
      this.element.find('.jsxc-members').attr('data-number-of-members', this.memberlistElement.find('li').length || '');
   }

   private addMucElementsToChatWindow() {
      this.addMemberList();

      this.addActionEntry('jsxc-members', this.toggleMemberList);

      this.addMenuEntry(
         'jsxc-destroy',
         Translation.t('Destroy'),
         () => {
            this.contact.destroy();
         }
      );

      this.addMenuEntry(
         'jsxc-configure',
         Translation.t('Configure'),
         () => {}
      );

      this.addMenuEntry(
         'jsxc-leave',
         Translation.t('Leave'),
         () => {
            this.contact.leave();
         }
      );
   }

   private addMemberList() {
      this.memberlistElement = $('<div class="jsxc-memberlist"><ul></ul></div>');
      this.element.find('.jsxc-window-fade').prepend(this.memberlistElement);
   }

   private toggleMemberList = (ev) => {
      if (ev) {
         ev.preventDefault();
      }

      let ul = this.memberlistElement.find('ul:first');

      this.memberlistElement.toggleClass('jsxc-expand');

      if (this.memberlistElement.hasClass('jsxc-expand')) {
         $('body').click();
         $('body').one('click', this.toggleMemberList);

         ul.mouseleave(function() {
            ul.data('timer', window.setTimeout(this.toggleMemberList, 2000));
         }).mouseenter(function() {
            window.clearTimeout(ul.data('timer'));
         });
      } else {
         window.clearTimeout(ul.data('timer'));
         $('body').off('click', null, this.toggleMemberList);
         ul.off('mouseleave mouseenter');
      }

      return false;
   }

   private getMemberElementByNickname(nickname:string) {
      return this.memberlistElement.find('.li[data-nickname="' + nickname + '"]');
   }

   private enable() {
      this.element.removeClass('jsxc-disabled');
   }

   private disable() {
      this.element.addClass('jsxc-disabled');
   }
}
