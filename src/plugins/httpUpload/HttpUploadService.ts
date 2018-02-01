import JID from '../../JID'
import Contact from '../../Contact'
import * as Namespace from '../../connection/xmpp/namespace'
import Log from '../../util/Log'
import { API as PluginAPI } from '../../plugin/PluginAPI.interface'
import Attachment from '../../Attachment'

export default class HttpUploadService {
   private namespace;

   constructor(private pluginAPI: PluginAPI, private jid: JID, private maxFileSize: number = 0) {
      this.namespace = Namespace.get('HTTPUPLOAD');
      this.maxFileSize = maxFileSize || 0;
   }

   public isSuitable(attachment: Attachment): boolean {
      return this.maxFileSize === 0 || attachment.getSize() <= this.maxFileSize;
   }

   public sendFile(file: File, progress?: (loaded, total) => void): Promise<string> {
      return this.requestSlot(file)
         .then((urls) => {
            return this.uploadFile(file, urls.put, progress).then(() => urls.get);
         });
   }

   private requestSlot(file: File) {
      var iq = $iq({
         to: this.jid.full,
         type: 'get'
      }).c('request', {
         xmlns: this.namespace
      }).c('filename').t(file.name)
         .up()
         .c('size').t(file.size.toString());

      return this.pluginAPI.sendIQ(iq)
         .then(this.parseSlotResponse)
         .catch(this.parseSlotError);
   }

   private parseSlotResponse = (stanza) => {
      let slot = $(stanza).find(`slot[xmlns="${this.namespace}"]`);

      if (slot.length > 0) {
         var put = slot.find('put').text();
         var get = slot.find('get').text();

         return Promise.resolve({
            put: put,
            get: get
         });
      }

      return this.parseSlotError(stanza);
   }

   private parseSlotError = (stanza) => {
      let error = {
         type: $(stanza).find('error').attr('type') || 'unknown',
         text: $(stanza).find('error text').text() || 'response does not contain a slot element',
         reason: null
      };

      if ($(stanza).find('error not-acceptable')) {
         error.reason = 'not-acceptable';
      } else if ($(stanza).find('error resource-constraint')) {
         error.reason = 'resource-constraint';
      } else if ($(stanza).find('error not-allowed')) {
         error.reason = 'not-allowed';
      }

      return Promise.reject(error);
   }

   private uploadFile = (file: File, putUrl, progress?: (loaded, total) => void) => {
      return new Promise((resolve, reject) => {
         $.ajax({
            url: putUrl,
            type: 'PUT',
            contentType: 'application/octet-stream',
            data: file,
            processData: false,
            xhr: function() {
               var xhr = (<any>$).ajaxSettings.xhr();

               // track upload progress
               xhr.upload.onprogress = function(ev) {
                  if (ev.lengthComputable && typeof progress === 'function') {
                     progress(ev.loaded, ev.total);
                  }
               };

               return xhr;
            },
            success: function() {
               Log.debug('file successful uploaded');

               resolve();
            },
            error: function() {
               Log.warn('error while uploading file to ' + putUrl);

               reject();
            }
         });
      });
   }
}
