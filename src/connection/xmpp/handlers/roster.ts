import Log from '../../../util/Log'
import JID from '../../../JID'
import Client from '../../../Client'
import Account from '../../../Account'
import ContactData from '../../../ContactData'
import Roster from '../../../ui/Roster'

const REMOVE_HANDLER = false;

export default function onRoster(stanzaElement: Element): boolean {
   Log.debug('Load roster', stanzaElement);

   let stanza = $(stanzaElement);
   let toJid = new JID(stanza.attr('to'));
   let account:Account = Client.getAccout(toJid);

   if (stanza.find('query').length === 0) {
      Log.debug('Use cached roster');

      // jsxc.restoreRoster();
      return REMOVE_HANDLER;
   }

   stanza.find('item').each(function() {
      let item = $(this);
      let jid = new JID(item.attr('jid'));
      let name = item.attr('name') || jid.bare;
      let subscription = item.attr('subscription');

      let contact = account.addContact(new ContactData({
         jid: jid,
         name: name,
         subscription: subscription
      }));

      Roster.get().add(contact);
   });

   let rosterVersion = $(stanza).find('query').attr('ver');

   if (rosterVersion) {
      account.getStorage().setItem('roster', 'version', rosterVersion);
   }

   return REMOVE_HANDLER;
}
