/**
 * @license
 * Copyright 2015 The Lovefield Project Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
goog.provide('lf.backstore.FirebaseTx');

goog.require('goog.Promise');
goog.require('lf.backstore.BaseTx');



/**
 * Psuedo transaction object for Firebase.
 *
 * @constructor
 * @struct
 * @final
 * @extends {lf.backstore.BaseTx}
 *
 * @param {!lf.backstore.Firebase} db
 * @param {!lf.TransactionType} type
 * @param {!lf.cache.Journal} journal
 */
lf.backstore.FirebaseTx = function(db, type, journal) {
  lf.backstore.FirebaseTx.base(this, 'constructor', journal, type);

  /** @private {!lf.backstore.Firebase} */
  this.db_ = db;
};
goog.inherits(lf.backstore.FirebaseTx, lf.backstore.BaseTx);


/** @override */
lf.backstore.FirebaseTx.prototype.getTable = function(name, deserializeFn) {
  return this.db_.getTableInternal(name);
};


/** @override */
lf.backstore.FirebaseTx.prototype.commitInternal = function() {
  var diffs = this.getJournal().getDiff();
  var numTableAffected = diffs.getCount();
  if (numTableAffected == 0) {
    this.resolver.resolve();
  } else {
    var rev = this.db_.getRevision() + 1;
    this.db_.setRevision(rev);

    // Prepare the update object.
    var update = { '@rev': { 'R': rev } };
    diffs.forEach(function(diff) {
      var tid = this.db_.getTableId(diff.getName());

      diff.getAdded().forEach(function(row, rowId) {
        update[rowId] = { 'R': rev, 'T': tid, 'P': row.payload() };
      });
      diff.getModified().forEach(function(rowPair, rowId) {
        update[rowId] = { 'R': rev, 'T': tid, 'P': rowPair[1].payload() };
      });
      diff.getDeleted().forEach(function(row, rowId) {
        update[rowId] = null;
      });
    }, this);

    this.db_.getRef().update(update, function(e) {
      if (!goog.isNull(e)) {  // error out
        this.db_.setRevision(rev - 1);
        var promises = diffs.getValues().map(function(diff) {
          return this.db_.reloadTable(diff.getName());
        }, this);
        goog.Promise.all(promises).then(
            this.resolver.reject.bind(this.resolver),
            this.resolver.reject.bind(this.resolver));
        return;
      }

      this.resolver.resolve();
    }.bind(this));
  }
  return this.resolver.promise;
};
