import ByteBuffer = require('bytebuffer')

let ArrayBufferUtils = {
   //@REVIEW do we really need all those functions?
   concat: (a: ArrayBuffer, b: ArrayBuffer) => ByteBuffer.concat([a, b]).toArrayBuffer(),

   decode: (a: ArrayBuffer): string => ByteBuffer.wrap(a).toUTF8(),

   encode: (s: string): ArrayBuffer => ByteBuffer.fromUTF8(s).toArrayBuffer(),

   toBase64: (a: ArrayBuffer): string => ByteBuffer.wrap(a).toBase64(),

   fromBase64: (s: string): ArrayBuffer => ByteBuffer.fromBase64(s).toArrayBuffer(),

   toString: (thing: ArrayBuffer | string): string => {
      if (typeof thing === 'string') {
         return thing;
      }

      return ByteBuffer.wrap(thing).toString('binary');
   },

   fromString: (thing: string): ArrayBuffer => {
      return ByteBuffer.wrap(thing, 'binary').toArrayBuffer();
   },

   toHex: (thing: ArrayBuffer | string): string => {
      if (typeof thing === 'undefined') {
         return '';
      }

      return ByteBuffer.wrap(thing).toString('hex');
   },

   toPrettyHex: (thing: ArrayBuffer | string): string => {
      return ArrayBufferUtils.toHex(thing).replace(/(.{8})/g, '$1 ').replace(/ $/, '');
   },

   isEqual: function(a: ArrayBuffer | string, b: ArrayBuffer | string) {
      if (a === undefined || b === undefined) {
         return false;
      }

      a = ArrayBufferUtils.toString(a);
      b = ArrayBufferUtils.toString(b);

      if (Math.min(a.length, b.length) < 5) {
         throw new Error('a/b compare too short');
      }

      return a === b;
   },

   toArray: (a: ArrayBuffer): Array<any> => Array.apply([], new Uint8Array(a)),

   fromArray: (a: Array<any>): ArrayBuffer => new Uint8Array(a).buffer,
}

export default ArrayBufferUtils;
