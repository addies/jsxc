import SignalStore, { IdentityKeyPair, PreKeyPair, SignedPreKeyPair } from '../vendor/SignalStore.interface'
import ArrayBufferUtils from '../util/ArrayBuffer'
import Store from '../lib/Store';
import Address from './Address';
import IdentityKey from '../model/IdentityKey'

export default class implements SignalStore {

   public Direction = {
      SENDING: 1,
      RECEIVING: 2
   };

   constructor(private store: Store) {

   }

   public getIdentityKeyPair(): Promise<IdentityKeyPair> {
      let identityKey = this.store.getLocalIdentityKey();

      return Promise.resolve({
         pubKey: identityKey.getPublic(),
         privKey: identityKey.getPrivate(),
      });
   }

   public getLocalRegistrationId(): Promise<number> {
      return Promise.resolve(this.store.getLocalRegistrationId());
   }

   public isTrustedIdentity(identifier: string, publicIdentityKey: ArrayBuffer, direction: number): Promise<boolean> {
      if (typeof identifier === 'undefined' || identifier === null) {
         throw new Error('Undefined or null is no valid identifier');
      }

      if (!(publicIdentityKey instanceof ArrayBuffer)) {
         throw new Error('Expected identityKey to be an ArrayBuffer');
      }

      let address = Address.fromString(identifier);
      let identityKey = new IdentityKey({ publicKey: publicIdentityKey });

      return this.store.isTrustedIdentity(address, identityKey);
   }

   public saveIdentity(identifier: string, publicIdentityKey: string | ArrayBuffer): Promise<boolean> {
      if (identifier === null || identifier === undefined) {
         throw new Error('Tried to put identity key for undefined/null key');
      }

      let address = Address.fromString(identifier);

      if (typeof publicIdentityKey === 'string') {
         publicIdentityKey = ArrayBufferUtils.fromString(publicIdentityKey);
      }

      if (publicIdentityKey.byteLength !== 33) {
         console.warn(`Identity key is ${publicIdentityKey.byteLength} byte long.`);
      }

      let identityKey = new IdentityKey({ publicKey: publicIdentityKey });

      return this.store.saveIdentity(address, identityKey);
   }

   public loadPreKey(keyId: number): Promise<undefined | PreKeyPair> {
      let preKey = this.store.getPreKey(keyId);
      let preKeyPair;

      if (preKey) {
         preKeyPair = {
            pubKey: preKey.getPublic(),
            privKey: preKey.getPrivate(),
         };
      }

      return Promise.resolve(preKeyPair);
   }

   public removePreKey(keyId: number): Promise<void> {
      //@TODO publish new bundle

      return this.store.removePreKey(keyId);
   }

   public loadSignedPreKey(keyId: number): Promise<undefined | SignedPreKeyPair> {
      let signedPreKey = this.store.getSignedPreKey(keyId);
      let signedPreKeyPair;

      if (signedPreKey) {
         signedPreKeyPair = {
            pubKey: signedPreKey.getPublic(),
            privKey: signedPreKey.getPrivate(),
            signature: signedPreKey.getSignature(),
         };
      }

      return signedPreKeyPair;
   }

   public loadSession(identifier: string): Promise<string | undefined> {
      return this.store.loadSession(identifier);
   }

   public storeSession(identifier: string, session: string): Promise<void> {
      return this.store.storeSession(identifier, session);
   }
}
