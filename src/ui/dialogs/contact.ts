import Dialog from '../Dialog';
import Contact from '../../Contact'
import Log from '../../util/Log'
import StorageSingleton from '../../StorageSingleton'
import Options from '../../Options'
import * as CONST from '../../CONST'
import Client from '../../Client'
import JID from '../../JID'

let contactTemplate = require('../../../template/contact.hbs');

let dialog: Dialog;
let contact: Contact;

export default function(username?: string) {
   let storage = StorageSingleton.getUserStorage();

   username = (typeof username === 'string') ? username : undefined;

   let content = contactTemplate({
      username: username
   });

   dialog = new Dialog(content);
   let dom = dialog.open();

   dom.find('[name="username"]').on('keyup', onUsernameKeyUp);
   dom.find('[name="username"]').on('input', onUsernameInput);
   dom.find('form').submit(onSubmit);
}

function onUsernameKeyUp() {
   let getUsers = Options.get('getUsers');

   if (typeof getUsers !== 'function') {
      return;
   }

   let val = $(this).val();
   $('#jsxc-userlist').empty();

   if (val !== '') {
      getUsers.call(this, val, function(list) {
         $('#jsxc-userlist').empty();

         $.each(list || {}, function(uid, displayname) {
            let option = $('<option>');
            option.attr('data-username', uid);
            option.attr('data-alias', displayname);

            option.attr('value', uid).appendTo('#jsxc-userlist');

            if (uid !== displayname) {
               option.clone().attr('value', displayname).appendTo('#jsxc-userlist');
            }
         });
      });
   }
}

function onUsernameInput() {
   let val = $(this).val();
   let option = $('#jsxc-userlist').find('option[data-username="' + val + '"], option[data-alias="' + val + '"]');

   if (option.length > 0) {
      $('#jsxc-username').val(option.attr('data-username'));
      $('#jsxc-alias').val(option.attr('data-alias'));
   }
}

function onSubmit(ev) {
   ev.preventDefault();

   let username = <string> $('#jsxc-username').val();
   let alias = <string> $('#jsxc-alias').val();
   //@TODO if we support multi account, we need an account selection dialog
   let account = Client.getAccout();

   if (!username.match(/@(.*)$/)) {
      username += '@' + account.getJID().domain;
   }

   // Check if the username is valid
   if (!username || !username.match(CONST.REGEX.JID)) {
      // Add notification
      $('#jsxc-username').addClass('jsxc-invalid').keyup(function() {
         if ((<string> $(this).val()).match(CONST.REGEX.JID)) {
            $(this).removeClass('jsxc-invalid');
         }
      });

      return false;
   }

   let jid = new JID(username);

   account.getConnection().addContact(jid, alias);

   dialog.close();
}
