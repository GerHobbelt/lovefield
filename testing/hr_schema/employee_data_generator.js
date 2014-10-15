/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
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
goog.provide('lf.testing.hrSchema.EmployeeDataGenerator');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.structs.Set');
goog.require('lf.testing.hrSchema.samples');



/**
 * Generates sample data for the Employee table.
 * @constructor
 *
 * @param {!hr.db.schema.Database} schema
 */
lf.testing.hrSchema.EmployeeDataGenerator = function(schema) {
  /** @private {!hr.db.schema.Database} */
  this.schema_ = schema;

  /**
   * A bag of salary values used to assign unique salaries to all generated
   * employees.
   * @private {!goog.structs.Set.<number>}
   */
  this.assignedSalaries_ = new goog.structs.Set();

  /** @private {number} */
  this.maxJobIndex_ = lf.testing.hrSchema.samples.JOB_TITLES.length;
};


/**
 * @param {number} count The number of rows to generate.
 * @return {!Array.<!hr.db.row.EmployeeType>}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.generateRaw_ =
    function(count) {
  var employees = new Array(count);
  for (var i = 0; i < count; i++) {
    var firstName = this.genFirstName_();
    var lastName = this.genLastName_();
    var email = firstName.toLowerCase() + '.' +
        lastName.toLowerCase() + '@theweb.com';
    var phoneNumber = String(
        1000000000 + Math.floor(Math.random() * 999999999));
    var commissionPercent = 0.15 + Math.random();

    employees[i] = {
      id: 'employeeId' + i.toString(),
      firstName: firstName,
      lastName: lastName,
      email: email,
      phoneNumber: phoneNumber,
      hireDate: this.genHireDate_(),
      jobId: this.genJobId_(),
      salary: this.genSalary_(),
      commissionPercent: commissionPercent,
      managerId: 'managerId',
      departmentId: 'departmentId',
      photo: this.genPhoto_()
    };
  }

  return employees;
};


/**
 * Sets the max index in JOB_TITLES that will be used for all generated
 * employees.
 * @param {number} maxJobIndex
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.setMaxJobId =
    function(maxJobIndex) {
  this.maxJobIndex_ = Math.min(
      maxJobIndex, lf.testing.hrSchema.samples.JOB_TITLES.length);
};


/**
 * @param {number} count The number of rows to generate.
 * @return {!Array.<!hr.db.row.Employee>}
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.generate = function(count) {
  var rawData = this.generateRaw_(count);

  return rawData.map(function(object) {
    return this.schema_.getEmployee().createRow(object);
  }, this);
};


/**
 * @return {string}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genFirstName_ = function() {
  var maxIndex = lf.testing.hrSchema.samples.FIRST_NAMES.length;
  var index = Math.floor(Math.random() * maxIndex);
  return lf.testing.hrSchema.samples.FIRST_NAMES[index];
};


/**
 * @return {string}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genLastName_ = function() {
  var maxIndex = lf.testing.hrSchema.samples.LAST_NAMES.length;
  var index = Math.floor(Math.random() * maxIndex);
  return lf.testing.hrSchema.samples.LAST_NAMES[index];
};


/**
 * @return {string}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genJobId_ = function() {
  var index = Math.floor(Math.random() * this.maxJobIndex_);
  return 'jobId' + index;
};


/**
 * @return {!Date}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genHireDate_ = function() {
  // Tue Jan 01 1980 10:00:00 GMT-0800 (PST)
  var min = new Date(315597600000);
  // Fri Sep 12 2014 13:52:20 GMT-0700 (PDT)
  var max = new Date(1410555147354);

  var diff = Math.random() * (max.getTime() - min.getTime());
  return new Date(min.getTime() + diff);
};


/**
 * @return {number}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genSalary_ = function() {
  var getNewSalary = function() {
    return 10000 + Math.floor(Math.random() * 200000);
  };

  var salary = null;
  do {
    salary = getNewSalary();
  } while (this.assignedSalaries_.contains(salary));

  this.assignedSalaries_.add(salary);
  return salary;
};


/**
 * @return {!ArrayBuffer}
 * @private
 */
lf.testing.hrSchema.EmployeeDataGenerator.prototype.genPhoto_ = function() {
  var buffer = new ArrayBuffer(8);
  var view = new Uint8Array(buffer);
  for (var i = 0; i < 8; ++i) {
    view[i] = i;
  }
  return buffer;
};
