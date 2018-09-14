import { $iq, Strophe } from 'strophe.js';
import Options from '../../Options';
import Log from '../../util/Log';
import SM from '../../StateMachine'
import Client from '../../Client'
import PersistentMap from '../../util/PersistentMap'
import InvalidParameterError from '../../errors/InvalidParameterError'
import ConnectionError from '../../errors/ConnectionError'
import AuthenticationError from '../../errors/AuthenticationError'

export function login(url: string, jid: string, sid: string, rid: string);
export function login(url: string, jid: string, password: string);
export function login() {
   if (arguments.length === 3) {
      return loginWithPassword(arguments[0], arguments[1], arguments[2]);
   } else if (arguments.length === 4) {
      return attachConnection(arguments[0], arguments[1], arguments[2], arguments[3]);
   } else {
      Log.warn('This should not happen');
   }
}

function loginWithPassword(url: string, jid: string, password: string): Promise<{}> {
   testBasicConnectionParameters(url, jid);
   let connection = prepareConnection(url);

   Log.debug('Try to establish a new connection.');

   return new Promise(function(resolve, reject) {
      //@TODO don't forget password from options
      connection.connect(jid, password, function(status, condition) {
         resolveConnectionPromise(status, condition, connection, resolve, reject);

         connectionCallback.apply(this, arguments);
      });
   });
}

function attachConnection(url: string, jid: string, sid: string, rid: string) {
   testBasicConnectionParameters(url, jid);
   let connection = prepareConnection(url);

   Log.debug('Try to attach old connection.');

   return new Promise(function(resolve, reject) {
      connection.attach(jid, sid, rid, function(status, condition) {
         resolveConnectionPromise(status, condition, connection, resolve, reject);

         connectionCallback.apply(this, arguments);
      });
   })
}

function resolveConnectionPromise(status, condition, connection, resolve, reject) {
   //@REVIEW how can this be removed after the promise resolves
   switch (status) {
      case Strophe.Status.CONNFAIL:
         reject(new ConnectionError(condition));
         break;
      case Strophe.Status.AUTHFAIL:
         reject(new AuthenticationError(condition));
         break;
      case Strophe.Status.ATTACHED:
      case Strophe.Status.CONNECTED:
         resolve({
            connection: connection,
            status: status
         });
         break;
   }
}

function testBasicConnectionParameters(url: string, jid: string) {
   if (!jid)
      throw new InvalidParameterError('I can not log in without a jid.');

   if (!url)
      throw new InvalidParameterError('I can not log in without an URL.');
}

function registerXMPPNamespaces() {
   Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
}

function prepareConnection(url: string): Strophe.Connection {
   let connection = new Strophe.Connection(url);

   if (Options.get('debug') || true) {
      connection.xmlInput = function(data) {
         Log.debug('<', data);
      };
      connection.xmlOutput = function(data) {
         Log.debug('>', data);
      };
   }

   if (connection.caps) {
      connection.caps.node = 'http://jsxc.org/';
   }

   SM.changeState(SM.STATE.ESTABLISHING);

   return connection;
}

function connectionCallback(status, condition) {

   Log.debug(Object.getOwnPropertyNames(Strophe.Status)[status] + ': ' + condition);

   switch (status) {
      case Strophe.Status.CONNECTING:
         $(document).trigger('connecting.jsxc');
         break;
      case Strophe.Status.CONNECTED:
         //jsxc.bid = jsxc.jidToBid(jsxc.xmpp.conn.jid.toLowerCase());
         $(document).trigger('connected.jsxc');
         break;
      case Strophe.Status.ATTACHED:
         $(document).trigger('attached.jsxc');
         break;
      case Strophe.Status.DISCONNECTED:
         $(document).trigger('disconnected.jsxc');
         break;
      case Strophe.Status.CONNFAIL:
         $(document).trigger('connfail.jsxc');
         break;
      case Strophe.Status.AUTHFAIL:
         $(document).trigger('authfail.jsxc');
         break;
   }
}
