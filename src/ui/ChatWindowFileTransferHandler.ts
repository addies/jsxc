import Contact from '../Contact'
import ChatWindow from '../ui/ChatWindow'
import Translation from '../util/Translation'
import Client from '../Client'
import ByteBeautifier from './util/ByteBeautifier'
import Attachment from '../Attachment'

export default class FileTransferHandler {
   private handlerElement;

   constructor(private contact: Contact, private chatWindow: ChatWindow) {
      this.handlerElement = this.chatWindow.getDom().find('.jsxc-file-transfer');

      this.handlerElement.on('click', this.showFileSelection);

      this.chatWindow.getDom().find('.jsxc-window').on('drop', (ev) => {
         ev.preventDefault();

         let files = (<any>ev.originalEvent).dataTransfer.files;

         if (files && files.length) {
            this.fileSelected(files[0]);
         }
      });
   }

   private showFileSelection = (ev) => {
      let jid = this.contact.getJid();

      if (ev.target !== this.handlerElement.get(0)) {
         // prevent bubbled event
         return;
      }

      this.showFileSelectionDialog();
   }

   private showFileSelectionDialog() {
      let labelElement = this.handlerElement.find('label');
      let fileElement = this.handlerElement.find('input');

      // open file selection for user
      labelElement.click();

      fileElement.off('change').change((ev) => {
         var file: File = ev.target.files[0]; // FileList object

         if (!file) {
            return;
         }

         this.fileSelected(file);
      });
   }

   private fileSelected(file: File) {
      let attachment = new Attachment(file);
      this.chatWindow.setAttachment(attachment);
   }
}
