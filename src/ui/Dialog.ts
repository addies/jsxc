import Storage from '../Storage';
import Log from '../util/Log';
import StorageSingleton from '../StorageSingleton';

let dialogTemplate = require('../../template/dialog.hbs');

export default class Dialog {

   private readonly id:string;

   private magnificPopupOptions = {
      items: null,
      modal: null,
      type: 'inline',
      callbacks: {
         beforeClose: this.onBeforeClose,
         afterClose: this.onAfterClose,
         open: this.onOpened
      }
   };

   // @REVIEW name is maybe unnecessary
   public constructor(content:string, unclosable:boolean = false, readonly name:string = '') {
      this.id = Dialog.generateId();

      let src = dialogTemplate({
         id: this.id,
         name: name,
         content: content
      });

      this.magnificPopupOptions.items = {
         src: src
      };
      this.magnificPopupOptions.modal = unclosable;
   }

   public open() {
      $.magnificPopup.open(this.magnificPopupOptions);

      return this.getDom();
   }

   public close() {
      Log.debug('close dialog');

      $.magnificPopup.close();
   }

   public resize() {

   }

   public getDom() {
      return $('.jsxc-dialog[data-name="'+this.name+'"]');
   }

   public append(content:string) {
      var dom = this.getDom();

      dom.append(content);
   }

   private onOpened = () => {
      let self = this;

      $('#jsxc_dialog .jsxc_close').click(function(ev) {
         ev.preventDefault();

         self.close();
      });

      $('#jsxc_dialog form').each(function() {
         var form = $(this);

         form.find('button[data-jsxc-loading-text]').each(function() {
            var btn = $(this);

            btn.on('btnloading.jsxc', function() {
               if (!btn.prop('disabled')) {
                  btn.prop('disabled', true);

                  btn.data('jsxc_value', btn.text());

                  btn.text(btn.attr('data-jsxc-loading-text'));
               }
            });

            btn.on('btnfinished.jsxc', function() {
               if (btn.prop('disabled')) {
                  btn.prop('disabled', false);

                  btn.text(btn.data('jsxc_value'));
               }
            });
         });
      });

      self.resize();

      $(document).trigger('complete.dialog.jsxc');
   }

   private onAfterClose() {
      $(document).trigger('close.dialog.jsxc');
   }

   private onBeforeClose() {
      $(document).trigger('cleanup.dialog.jsxc');
   }

   private static generateId():string {
      let random = Math.round(Math.random() * Math.pow(10, 20)).toString();

      return 'dialog-' + random;
   }
}
