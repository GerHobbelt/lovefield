/**
 * @license
 * Copyright 2014 The Lovefield Project Authors. All Rights Reserved.
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
goog.setTestOnly();

goog.require('goog.string');
goog.require('goog.structs.Set');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');
goog.require('lf.Order');
goog.require('lf.Row');
goog.require('lf.index.BTree');
goog.require('lf.index.MultiKeyComparator');
goog.require('lf.index.SimpleComparator');
goog.require('lf.index.SingleKeyRange');
goog.require('lf.testing.index.TestMultiKeyIndex');
goog.require('lf.testing.index.TestMultiRowNumericalKey');
goog.require('lf.testing.index.TestSingleRowNumericalKey');
goog.require('lf.testing.index.TestSingleRowStringKey');


/** @type {!goog.testing.PropertyReplacer} */
var stub;


/** @type {!lf.index.SimpleComparator} */
var c;


/** @type {!lf.index.SimpleComparator} */
var c2;


function setUp() {
  c = new lf.index.SimpleComparator(lf.Order.ASC);
  c2 = new lf.index.SimpleComparator(lf.Order.DESC);

  // Replace the max count of B-Tree to 5 so that we verify the tree
  // construction algorithm.
  stub = new goog.testing.PropertyReplacer();
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MAX_COUNT_',
      5);
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MAX_KEY_LEN_',
      5 - 1);
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MIN_KEY_LEN_',
      5 >> 1);
  stub.replace(
      goog.getObjectByName('lf.Row'),
      'nextId_',
      0);
}


/** @const {!Array<number>} */
var SEQUENCE = [
  13, 9, 21, 17,
  5,
  11, 3, 25, 27,
  14, 15, 31, 29, 22, 23, 38, 45, 47,
  49,
  1,
  10, 12, 16];


/** @const {!Array<!Array<number, string>>} */
var SEQUENCE2 = [
  [13, '13'], [9, '09'], [21, '21'], [17, '17'],
  [5, '05'],
  [11, '11'], [3, '03'], [25, '25'], [27, '27'],
  [14, '14'], [15, '15'], [31, '31'], [29, '29'], [22, '22'],
  [23, '23'], [38, '38'], [45, '45'], [47, '47'],
  [49, '49'],
  [1, '1'],
  [10, '10'], [12, '12'], [16, '16']
];


/**
 * @param {number} index
 * @param {boolean=} opt_duplicate
 * @return {!lf.index.BTree} The tree generated
 */
function insertToTree(index, opt_duplicate) {
  var unique = !opt_duplicate;
  var tree = new lf.index.BTree('test', c, unique);
  var i = 0;
  while (i < index) {
    tree.add(SEQUENCE[i], SEQUENCE[i]);
    if (opt_duplicate) {
      tree.add(SEQUENCE[i], SEQUENCE[i] * 1000);
    }
    i++;
  }
  return tree;
}


/**
 * @param {number} index
 * @param {!lf.index.Comparator} comparator
 * @param {boolean=} opt_duplicate
 * @return {!lf.index.BTree} The tree generated
 */
function insertToTree2(index, comparator, opt_duplicate) {
  var unique = !opt_duplicate;
  var tree = new lf.index.BTree('test', comparator, unique);
  var i = 0;
  while (i < index) {
    tree.add(SEQUENCE2[i], SEQUENCE2[i][0]);
    if (opt_duplicate) {
      tree.add(SEQUENCE[i], SEQUENCE[i][0] * 1000);
    }
    i++;
  }
  return tree;
}


/**
 * @param {!Array<!lf.Row>} rows
 * @return {!lf.index.BTree}
 */
function deserializeTree(rows) {
  return lf.index.BTree.deserialize(c, 'test', true, rows);
}


function testEmptyTree() {
  // Creating empty tree shall have no problem.
  var tree = insertToTree(0);
  var expected = '0[]\n_{}_\n';
  assertEquals(expected, tree.toString());

  // Serialize and deserialize should have no problem.
  var rows = tree.serialize();
  assertEquals(1, rows.length);
  var tree2 = deserializeTree(rows);
  assertEquals(expected, tree2.toString());
}

function testLeafNodeAsRoot() {
  var tree = insertToTree(4);
  var expected =
      '0[9|13|17|21]\n' +
      '_{9/13/17/21}_\n';
  assertEquals(expected, tree.toString());

  // Serialize and deserialize should have no problem.
  var rows = tree.serialize();
  assertEquals(1, rows.length);
  var tree2 = deserializeTree(rows);
  assertEquals(expected, tree2.toString());
}


/**
 * Splits the root node to form new root node.
 *
 * 9|13|17|21
 *
 * insert 5
 *
 *     13
 *    /  \
 *  5|9  13|17|21
 */
function testFirstInternalNode() {
  var tree = insertToTree(5);
  var expected =
      '2[13]\n' +
      '_{0|1}_\n' +
      '0[5|9]  1[13|17|21]\n' +
      '_{5/9}2  0{13/17/21}2\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node.
 *
 *        13
 *     /     \
 * 3|5|9|11  13|17|21|25
 *
 * insert 27
 *
 *          13|21
 *     /      |      \
 * 3|5|9|11  13|17   21|25|27
 */
function testSplit_Case1() {
  var tree = insertToTree(9);
  var expected =
      '2[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{3/5/9/11}2  0{13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());

  // Serialize and deserialize should have no problem.
  // Note: Tree deserialization will create internal and root nodes on-the-fly
  //       and therefore the node id will be different. Moreover, the internal
  //       nodes can also be different since a rebalancing is done. That's the
  //       reason to use expected2 in this case and following serialization
  //       tests.
  var expected2 =
      '6[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{3/5/9/11}6  0{13/17}6  1{21/25/27}6\n';
  var rows = tree.serialize();
  assertEquals(3, rows.length);
  var tree2 = deserializeTree(rows);
  assertEquals(expected2, tree2.toString());
}


/**
 * Split of leaf node inducing split of internal nodes and a new level.
 *
 *                        13|21|27|31
 *     /          /            |         \         \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38|45|47
 *
 * insert 49
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case2() {
  var tree = insertToTree(19);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|45]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node promoting a new key in internal node.
 *
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * insert 1
 *                               27
 *               /                              \
 *            5|13|21                         31|45
 *  /      /         \            \          /     |      \
 * 1|3  5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case3() {
  var tree = insertToTree(20);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[5|13|21]  12[31|45]\n' +
      '_{0|13|1|3}11  2{5|7|9}11\n' +
      '0[1|3]  13[5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{5/9/11}2  13{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());

  // Serialize and deserialize should have no problem.
  var expected2 =
      '16[27]\n' +
      '_{17|18}_\n' +
      '17[5|13|21]  18[31|45]\n' +
      '_{0|13|1|3}16  17{5|7|9}16\n' +
      '0[1|3]  13[5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}17  0{5/9/11}17  13{13/14/15/17}17  1{21/22/23/25}17' +
      '  3{27/29}18  5{31/38}18  7{45/47/49}18\n';
  var rows = tree.serialize();
  assertEquals(7, rows.length);
  var tree2 = deserializeTree(rows);
  assertEquals(expected2, tree2.toString());
}


/**
 * Split of leaf node causing double promotion.
 *
 *                                 27
 *               /                                        \
 *          5|10|13|21                                  31|45
 *  /      /    |           \            \          /     |      \
 * 1|3  5|9  10|11|12  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * insert 16
 *
 *                              13|27
 *               /                |                           \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case4() {
  var tree = insertToTree(23);
  var expected =
      '11[13|27]\n' +
      '_{2|20|12}_\n' +
      '2[5|10]  20[15|21]  12[31|45]\n' +
      '_{0|13|15}11  2{1|17|3}11  20{5|7|9}11\n' +
      '0[1|3]  13[5|9]  15[10|11|12]  1[13|14]  17[15|16|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{5/9}2  13{10/11/12}2' +
      '  15{13/14}20  1{15/16/17}20  17{21/22/23/25}20' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 * Tests split leaf and internal which have links to the right.
 *
 *                               363
 *             /                                     \
 *          98|100                                 366|369
 *     /      |       \                    /          |         \
 * -995|97  98|99  100|101|102|103  363|364|365  366|367|368 369|370|371
 *
 *  insert 104
 *                               363
 *                /                                       \
 *             98|100|102                              366|369
 *     /      |       \       \                /          |         \
 * -995|97  98|99  100|101  102|103|104  363|364|365  366|367|368 369|370|371
 */
function testSplit_Case5() {
  var tree = new lf.index.BTree('test', c, true);
  var keys = [
    -995, 371, 370, 369,
    368,  // New level created here
    367, 366, 365, 364, 363, 97, 98, 99, 100, 101,
    102,  // New level created here
    103, 104,  // Split leaf node with right link
    105, 106, 486,
    107, 108  // Split internal node with right link
  ];
  for (var i = 0; i < keys.length; ++i) {
    tree.add(keys[i], i);
  }

  var expected =
      '11[102|363]\n' +
      '_{2|20|12}_\n' +
      '2[98|100]  20[104|106]  12[366|369]\n' +
      '_{0|7|9}11  2{13|15|17}11  20{5|3|1}11\n' +
      '0[-995|97]  7[98|99]  9[100|101]' +
      '  13[102|103]  15[104|105]  17[106|107|108]' +
      '  5[363|364|365]  3[366|367|368]  1[369|370|371|486]\n' +
      '_{0/10}2  0{11/12}2  7{13/14}2' +
      '  9{15/16}20  13{17/18}20  15{19/21/22}20' +
      '  17{9/8/7}12  5{6/5/4}12  3{3/2/1/20}12\n';

  assertEquals(expected, tree.toString());
}

function testContainsKey() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertTrue(tree.containsKey(key));
  }
  assertFalse(tree.containsKey(0));
  assertFalse(tree.containsKey(18));
  assertFalse(tree.containsKey(50));
}

function testGet() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertArrayEquals([key], tree.get(key));
  }
  assertArrayEquals([], tree.get(0));
  assertArrayEquals([], tree.get(18));
  assertArrayEquals([], tree.get(50));
}

function testConstructFromData() {
  var key = SEQUENCE.slice(0, 23).sort(function(a, b) { return a - b; });
  var data = key.map(function(i) {
    return {key: i, value: i};
  });
  var tree = new lf.index.BTree('test', c, true, data);
  var expected =
      '6[21]\n' +
      '_{7|8}_\n' +
      '7[10|14]  8[27|45]\n' +
      '_{0|1|2}6  7{3|4|5}6\n' +
      '0[1|3|5|9]  1[10|11|12|13]  2[14|15|16|17]  3[21|22|23|25]' +
      '  4[27|29|31|38]  5[45|47|49]\n' +
      '_{1/3/5/9}7  0{10/11/12/13}7  1{14/15/16/17}7' +
      '  2{21/22/23/25}8  3{27/29/31/38}8  4{45/47/49}8\n';
  assertEquals(expected, tree.toString());
}


/**
 * Deletes the last few keys from root.
 *
 * 9|13|17|21
 *
 * Delete 9, 17, 21, and 13. Also tests deleting an non-existent value shall
 * yield no-op.
 */
function testDelete_RootSimple() {
  var tree = insertToTree(4);
  tree.remove(9);
  tree.remove(17);
  tree.remove(21);
  assertEquals('0[13]\n_{13}_\n', tree.toString());
  tree.remove(22);
  assertEquals('0[13]\n_{13}_\n', tree.toString());
  tree.remove(13);
  assertEquals('0[]\n_{}_\n', tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 3 should just change the left most leaf node.
 */
function testDelete_Simple() {
  var tree = insertToTree(9);
  tree.remove(3);
  var expected =
      '2[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{5/9/11}2  0{13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 17
 *
 *          13|25
 *     /      |       \
 * 3|5|9|11  13|21  25|27
 */
function testDelete_LeafStealFromRight() {
  var tree = insertToTree(9);
  tree.remove(17);
  var expected =
      '2[13|25]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|21]  3[25|27]\n' +
      '_{3/5/9/11}2  0{13/21}2  1{25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|25
 *     /      |       \
 * 3|5|9|11  13|21  25|27
 *
 * delete 21
 *
 *         11|25
 *      /    |     \
 * 3|5|9  11|13  25|27
 */
function testDelete_LeafStealFromLeft() {
  var tree = insertToTree(9);
  tree.remove(17);
  tree.remove(21);
  var expected =
      '2[11|25]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9]  1[11|13]  3[25|27]\n' +
      '_{3/5/9}2  0{11/13}2  1{25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *         11|25
 *      /    |     \
 * 3|5|9  11|13  25|27
 *
 * delete 9, 13
 *
 *      11
 *    /    \
 * 3|5  11|25|27
 */
function testDelete_LeafMergeRight() {
  var tree = insertToTree(9);
  tree.remove(17);
  tree.remove(21);
  tree.remove(9);
  tree.remove(13);
  var expected =
      '2[11]\n' +
      '_{0|3}_\n' +
      '0[3|5]  3[11|25|27]\n' +
      '_{3/5}2  0{11/25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 27, 25
 *
 *         13
 *     /        \
 * 3|5|9|11  13|17|21
 */
function testDelete_LeafMergeLeft() {
  var tree = insertToTree(9);
  tree.remove(27);
  tree.remove(25);
  var expected =
      '2[13]\n' +
      '_{0|1}_\n' +
      '0[3|5|9|11]  1[13|17|21]\n' +
      '_{3/5/9/11}2  0{13/17/21}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *     13
 *    /  \
 *  5|9  13|17|21
 *
 *  delete 5
 *
 *      17
 *    /    \
 *  9|13  17|21
 *
 *  delete 13
 *
 *  9|17|21
 */
function testDelete_MergeRightAndPromoteAsRoot() {
  var tree = insertToTree(5);
  tree.remove(5);
  tree.remove(13);
  var expected =
      '1[9|17|21]\n' +
      '_{9/17/21}_\n';
  assertEquals(expected, tree.toString());
}


/**
 *     13
 *    /  \
 *  5|9  13|17|21
 *
 *  delete 17
 *
 *      13
 *    /    \
 *  5|9  13|21
 *
 *  delete 21
 *
 *  5|9|13
 */
function testDelete_MergeLeftAndPromoteAsRoot() {
  var tree = insertToTree(5);
  tree.remove(17);
  tree.remove(21);
  var expected =
      '0[5|9|13]\n' +
      '_{5/9/13}_\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 45
 *                              27
 *                 /                            \
 *              13|21                         31|47
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  47|49
 */
function testDelete_InternalNodeKey() {
  var tree = insertToTree(19);
  tree.remove(45);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|47]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 27
 *
 *                             25
 *                  /                       \
 *               13|21                     31|45
 *      /          |          \       /      |       \
 * 3|5|9|11  13|14|15|17  21|22|23  25|29  31|38  45|47|49
 */
function testDelete_InternalNodeKey2() {
  var tree = insertToTree(19);
  tree.remove(27);
  var expected =
      '11[25]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|45]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23]' +
      '  5[25|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23}2' +
      '  3{25/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              13|27
 *         /                      |                          \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 16, 12, 10, 1, 49
 *
 *                               27
 *              /                              \
 *        11|15|21                            31|45
 *    /      |       \         \          /     |      \
 * 3|5|9  11|13|14  15|17  21|22|23|25  27|29  31|38  45|47
 *
 * delete 47
 *                         21
 *             /                         \
 *          11|15                       27|31
 *    /      |       \         /          |       \
 * 3|5|9  11|13|14  15|17  21|22|23|25  27|29  31|38|45
 */
function testDelete_StealLeft() {
  var tree = insertToTree(23);
  tree.remove(16);
  tree.remove(12);
  tree.remove(10);
  tree.remove(1);
  tree.remove(49);
  tree.remove(47);
  var expected =
      '11[21]\n' +
      '_{20|12}_\n' +
      '20[11|15]  12[27|31]\n' +
      '_{13|1|17}11  20{3|5|7}11\n' +
      '13[3|5|9]  1[11|13|14]  17[15|17]' +
      '  3[21|22|23|25]  5[27|29]  7[31|38|45]\n' +
      '_{3/5/9}20  13{11/13/14}20  1{15/17}20' +
      '  17{21/22/23/25}12  3{27/29}12  5{31/38/45}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              13|27
 *               /                |                          \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 25, 23, 22, 21, 17, 12
 *
 *                     13
 *        /                            \
 *      5|10                      15|27|31|45
 *  /    |     \         /      /      |      \      \
 * 1|3  5|9  10|11  13|14  15|16  27|29  31|38  45|47|49
 *
 * delete 5
 *
 *                     15
 *          /                        \
 *        9|13                    27|31|45
 *  /      |       \      /      /      \       \
 * 1|3  9|10|11  13|14  15|16  27|29  31|38  45|47|49
 */
function testDelete_StealRight() {
  var tree = insertToTree(23);
  tree.remove(25);
  tree.remove(23);
  tree.remove(22);
  tree.remove(21);
  tree.remove(17);
  tree.remove(12);
  tree.remove(5);
  var expected =
      '11[15]\n' +
      '_{2|12}_\n' +
      '2[9|13]  12[27|31|45]\n' +
      '_{0|15|1}11  2{17|5|7|9}11\n' +
      '0[1|3]  15[9|10|11]  1[13|14]' +
      '  17[15|16]  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{9/10/11}2  15{13/14}2' +
      '  1{15/16}12  17{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|47
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  47|49
 *
 * delete 47
 *
 *                        13|21|27|31
 *     /          /            |         \        \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38|49
 */
function testDelete_MergeLeft() {
  var tree = insertToTree(19);
  tree.remove(45);
  tree.remove(47);
  var expected =
      '2[13|21|27|31]\n' +
      '_{0|1|3|5|7}_\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]  5[27|29]  7[31|38|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2  3{27/29}2' +
      '  5{31/38/49}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 9, 11, 15, 17, 23, 25
 *
 *                     27
 *            /                 \
 *        13|21                31|45
 *     /    |      \       /     |      \
 *   3|5  13|14  21|22  27|29  31|38  45|47|49

 * delete 13
 *
 *             14|27|31|45
 *   /      /       |      \       \
 * 3|5  14|21|22  27|29  31|38  45|47|49
 */
function testDelete_MergeRight() {
  var tree = insertToTree(19);
  tree.remove(9);
  tree.remove(11);
  tree.remove(15);
  tree.remove(17);
  tree.remove(23);
  tree.remove(25);
  tree.remove(13);
  var expected =
      '12[14|27|31|45]\n' +
      '_{0|3|5|7|9}_\n' +
      '0[3|5]  3[14|21|22]  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5}12  0{14/21/22}12  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 3, 5, 9
 *
 *         21
 *      /      \
 * 11|13|17  21|25|27
 */
function testDelete_MergeRight2() {
  var tree = insertToTree(9);
  tree.remove(3);
  tree.remove(5);
  tree.remove(9);
  var expected =
      '2[21]\n' +
      '_{1|3}_\n' +
      '1[11|13|17]  3[21|25|27]\n' +
      '_{11/13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());
}

function testDelete_All() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; ++i) {
    tree.remove(SEQUENCE[i]);
  }
  assertEquals('17[]\n_{}_\n', tree.toString());
}

function testDelete_All2() {
  var tree = insertToTree(23);
  for (var i = 22; i >= 0; --i) {
    tree.remove(SEQUENCE[i]);
  }
  assertEquals('13[]\n_{}_\n', tree.toString());
}

function testDelete_None() {
  var tree = insertToTree(23);
  tree.remove(18);
  var expected =
      '11[13|27]\n' +
      '_{2|20|12}_\n' +
      '2[5|10]  20[15|21]  12[31|45]\n' +
      '_{0|13|15}11  2{1|17|3}11  20{5|7|9}11\n' +
      '0[1|3]  13[5|9]  15[10|11|12]  1[13|14]  17[15|16|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{5/9}2  13{10/11/12}2' +
      '  15{13/14}20  1{15/16/17}20  17{21/22/23/25}20' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}

function testSingleRow_NumericalKey_Asc() {
  var test = new lf.testing.index.TestSingleRowNumericalKey(function() {
    return new lf.index.BTree('test', c, true);
  });
  test.run();
}

function testSingleRow_NumericalKey_Desc() {
  var test = new lf.testing.index.TestSingleRowNumericalKey(function() {
    return new lf.index.BTree('test', c2, true);
  }, true);
  test.run();
}

function testSingleRow_StringKey_Asc() {
  var test = new lf.testing.index.TestSingleRowStringKey(function() {
    return new lf.index.BTree('test', c, true);
  });
  test.run();
}

function testSingleRow_StringKey_Desc() {
  var test = new lf.testing.index.TestSingleRowStringKey(function() {
    return new lf.index.BTree('test', c2, true);
  }, true);
  test.run();
}

function testMultiKeyIndex() {
  var test = new lf.testing.index.TestMultiKeyIndex(function() {
    return new lf.index.BTree(
        'test',
        new lf.index.MultiKeyComparator([lf.Order.ASC, lf.Order.DESC]),
        true);
  });
  test.run();
}

function testMultiRow_NumericalKey() {
  var test = new lf.testing.index.TestMultiRowNumericalKey(function() {
    return new lf.index.BTree('test', c, false);
  });
  test.run();
}

function testGetRange_Numeric() {
  var tree = new lf.index.BTree('test', c, true);
  for (var i = -10; i <= 10; ++i) {
    tree.set(i, i);
  }

  var results = tree.getRange();
  assertEquals(21, results.length);
  assertEquals(-10, results[0]);
  assertEquals(10, results[20]);
  var results2 = tree.getRange([lf.index.SingleKeyRange.all()]);
  assertArrayEquals(results, results2);

  results = tree.getRange([lf.index.SingleKeyRange.only(0)]);
  assertEquals(1, results.length);
  assertEquals(0, results[0]);

  results = tree.getRange([lf.index.SingleKeyRange.only(12)]);
  assertArrayEquals([], results);

  results = tree.getRange([lf.index.SingleKeyRange.lowerBound(0)]);
  assertEquals(11, results.length);
  assertEquals(0, results[0]);
  assertEquals(10, results[10]);

  results = tree.getRange([lf.index.SingleKeyRange.upperBound(0)]);
  assertEquals(11, results.length);
  assertEquals(-10, results[0]);
  assertEquals(0, results[10]);

  results = tree.getRange([lf.index.SingleKeyRange.lowerBound(0, true)]);
  assertEquals(10, results.length);
  assertEquals(1, results[0]);
  assertEquals(10, results[9]);

  results = tree.getRange([lf.index.SingleKeyRange.upperBound(0, true)]);
  assertEquals(10, results.length);
  assertEquals(-10, results[0]);
  assertEquals(-1, results[9]);

  tree.remove(7);
  results = tree.getRange([lf.index.SingleKeyRange.only(7)]);
  assertEquals(0, results.length);
}

function testGetRange_EmptyTree() {
  var tree = new lf.index.BTree(
      'test',
      new lf.index.MultiKeyComparator([lf.Order.ASC, lf.Order.DESC]),
      true);
  assertArrayEquals([], tree.getRange());
}

function testUniqueConstraint() {
  var tree = insertToTree(9);
  var thrower = function() {
    tree.add(13, 13);
  };
  assertThrows(thrower);
}

function testRandomNumbers() {
  stub.reset();
  var ROW_COUNT = 5000;
  var set = new goog.structs.Set();
  while (set.getCount() < ROW_COUNT) {
    set.add(Math.floor(Math.random() * ROW_COUNT * 100));
  }

  var keys = set.getValues().sort(function(a, b) {
    return a - b;
  });

  var tree = new lf.index.BTree('test', c, true);
  var tree2 = new lf.index.BTree('test', c2, true);
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.add(keys[i], keys[i]);
    tree2.add(keys[i], keys[i]);
  }

  assertArrayEquals(keys, tree.getRange());
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.remove(keys[i]);
    tree2.remove(keys[i]);
  }

  assertArrayEquals([], tree.getRange());
  assertArrayEquals([], tree2.getRange());
}

function testDuplicateKeys_LeafNodeAsRoot() {
  var tree = insertToTree(4, true);
  var expected =
      '0[9|13|17|21]\n' +
      '_{9,9000/13,13000/17,17000/21,21000}_\n';
  assertEquals(expected, tree.toString());

  // Serialize and deserialize should have no problem.
  var rows = tree.serialize();
  assertEquals(1, rows.length);
  var tree2 = deserializeTree(rows);
  assertEquals(expected, tree2.toString());
}

function testDuplicateKeys_DeleteNone() {
  var tree = insertToTree(23, true);
  tree.remove(18);
  var expected =
      '11[13|27]\n' +
      '_{2|20|12}_\n' +
      '2[5|10]  20[15|21]  12[31|45]\n' +
      '_{0|13|15}11  2{1|17|3}11  20{5|7|9}11\n' +
      '0[1|3]  13[5|9]  15[10|11|12]  1[13|14]  17[15|16|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1,1000/3,3000}2  0{5,5000/9,9000}2  13{10,10000/11,11000/12,12000}2' +
      '  15{13,13000/14,14000}20  1{15,15000/16,16000/17,17000}20  ' +
      '17{21,21000/22,22000/23,23000/25,25000}20' +
      '  3{27,27000/29,29000}12  5{31,31000/38,38000}12  ' +
      '7{45,45000/47,47000/49,49000}12\n';
  assertEquals(expected, tree.toString());
}

function testDuplicateKeys_ContainsKey() {
  var tree = insertToTree(23, true);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertTrue(tree.containsKey(key));
  }
  assertFalse(tree.containsKey(0));
  assertFalse(tree.containsKey(18));
  assertFalse(tree.containsKey(50));
}

function testDuplicateKeys_Get() {
  var tree = insertToTree(23, true);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertArrayEquals([key, key * 1000], tree.get(key));
  }
  assertArrayEquals([], tree.get(0));
  assertArrayEquals([], tree.get(18));
  assertArrayEquals([], tree.get(50));
}

function testDuplicateKeys_DeleteSimple() {
  var tree = insertToTree(9, true);
  tree.remove(13, 13);
  var expected =
      '2[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{3,3000/5,5000/9,9000/11,11000}2  0{13000/17,17000}2  ' +
      '1{21,21000/25,25000/27,27000}2\n';
  assertEquals(expected, tree.toString());
  assertArrayEquals([13000], tree.get(13));
  assertArrayEquals([13000], tree.getRange([lf.index.SingleKeyRange.only(13)]));
}

function testDuplicateKeys_DeleteAll() {
  var tree = insertToTree(23, true);
  for (var i = 0; i < 23; ++i) {
    tree.remove(SEQUENCE[i], SEQUENCE[i]);
    tree.remove(SEQUENCE[i], SEQUENCE[i] * 1000);
  }
  assertEquals('17[]\n_{}_\n', tree.toString());
}

function testDuplicateKeys_DeleteAll2() {
  var tree = insertToTree(23, true);
  for (var i = 22; i >= 0; --i) {
    tree.remove(SEQUENCE[i], SEQUENCE[i]);
    tree.remove(SEQUENCE[i], SEQUENCE[i] * 1000);
  }
  assertEquals('13[]\n_{}_\n', tree.toString());
}

function testDuplicateKeys_SmokeTest() {
  var tree = insertToTree(23, true);
  for (var i = 0; i < SEQUENCE.length; ++i) {
    assertEquals(2, tree.cost(lf.index.SingleKeyRange.only(SEQUENCE[i])));
    assertArrayEquals(
        [SEQUENCE[i], SEQUENCE[i] * 1000],
        tree.get(SEQUENCE[i]));
    assertArrayEquals(
        [SEQUENCE[i], SEQUENCE[i] * 1000],
        tree.getRange([lf.index.SingleKeyRange.only(SEQUENCE[i])]));
  }
  assertEquals(2 * SEQUENCE.length, tree.cost(lf.index.SingleKeyRange.all()));

  for (var i = 0; i < SEQUENCE.length; ++i) {
    tree.remove(SEQUENCE[i], SEQUENCE[i]);
    assertEquals(1, tree.cost(lf.index.SingleKeyRange.only(SEQUENCE[i])));
    assertArrayEquals([SEQUENCE[i] * 1000], tree.get(SEQUENCE[i]));
    assertArrayEquals(
        [SEQUENCE[i] * 1000],
        tree.getRange([lf.index.SingleKeyRange.only(SEQUENCE[i])]));
  }
  assertEquals(SEQUENCE.length, tree.cost(lf.index.SingleKeyRange.all()));

  tree.clear();
  assertEquals(0, tree.cost(lf.index.SingleKeyRange.all()));
}

function testMultiKeyGet() {
  var comparator = new lf.index.MultiKeyComparator(
      lf.index.MultiKeyComparator.createOrders(2, lf.Order.ASC));
  var tree = insertToTree2(23, comparator);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE2[i];
    assertArrayEquals([key[0]], tree.get(key));
  }
  assertArrayEquals([], tree.get([0, '00']));
  assertArrayEquals([], tree.get([18, '18']));
  assertArrayEquals([], tree.get([50, '50']));
}

function testMultiKeyRandomNumbers() {
  stub.reset();
  var ROW_COUNT = 5000;
  var set = new goog.structs.Set();
  while (set.getCount() < ROW_COUNT) {
    set.add(Math.floor(Math.random() * ROW_COUNT * 100));
  }

  var numbers = set.getValues().sort(function(a, b) {
    return a - b;
  });

  var keys = numbers.map(function(n) {
    return [n, -n];
  });

  var comparator = new lf.index.MultiKeyComparator(
      [lf.Order.ASC, lf.Order.DESC]);
  var tree = new lf.index.BTree('test', comparator, true);
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.add(keys[i], keys[i][0]);
  }

  assertArrayEquals(numbers, tree.getRange());
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.remove(keys[i]);
  }

  assertArrayEquals([], tree.getRange());
}

function testMultiKeyGetRangeRegression() {
  var comparator = new lf.index.MultiKeyComparator(
      lf.index.MultiKeyComparator.createOrders(2, lf.Order.ASC));
  var tree = new lf.index.BTree('test', comparator, true);
  var data = [
    ['F', 'A'], ['F', 'B'], ['F', 'C'], ['F', 'D'],
    ['G', 'B'], ['G', 'G'], ['G', 'X'],
    ['P', 'K'], ['P', 'M'], ['P', 'P'],
    ['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D']
  ];
  for (var i = 0; i < data.length; ++i) {
    tree.add(data[i], i);
  }
  var keyRange = [[
    lf.index.SingleKeyRange.only('G'),
    lf.index.SingleKeyRange.only('X')
  ]];
  assertArrayEquals([6], tree.getRange(keyRange));

  var keyRange2 = [[
    lf.index.SingleKeyRange.only('P'),
    lf.index.SingleKeyRange.only('P')
  ]];
  assertArrayEquals([9], tree.getRange(keyRange2));

  assertArrayEquals(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      tree.getRange());

  var comparator2 = new lf.index.MultiKeyComparator(
      [lf.Order.ASC, lf.Order.DESC]);
  var tree2 = new lf.index.BTree('test2', comparator2, true);
  for (var i = 0; i < data.length; ++i) {
    tree2.add(data[i], i);
  }
  assertArrayEquals([6], tree2.getRange(keyRange));
  assertArrayEquals([9], tree2.getRange(keyRange2));
  assertArrayEquals(
      [3, 2, 1, 0, 6, 5, 4, 9, 8, 7, 13, 12, 11, 10],
      tree2.getRange());
}

function testStats() {
  var tree = insertToTree(23, false);
  assertEquals(23, tree.stats().totalRows);
  tree.remove(9);
  tree.remove(17);
  tree.remove(21);
  assertEquals(20, tree.stats().totalRows);
  tree.add(9, 9);
  tree.add(21, 21);
  assertEquals(22, tree.stats().totalRows);
  tree.set(9, 8);
  assertEquals(22, tree.stats().totalRows);
  tree.set(999, 888);
  assertEquals(23, tree.stats().totalRows);
  tree.clear();
  assertEquals(0, tree.stats().totalRows);
  for (var i = 0; i < 23; ++i) {
    tree.set(i, i);
  }
  assertEquals(23, tree.stats().totalRows);

  // Non-unique tree, each key has two rows.
  tree = insertToTree(23, true);
  assertEquals(46, tree.stats().totalRows);
  // Remove all rows for the given key.
  tree.remove(21);
  assertEquals(44, tree.stats().totalRows);
  // Remove only one row for the given key.
  tree.remove(17, 17);
  assertEquals(43, tree.stats().totalRows);
  tree.remove(17, 9999);  // remove non-existing row
  assertEquals(43, tree.stats().totalRows);
  tree.set(17, 7777);
  tree.add(17, 8888);
  tree.add(17, 9999);
  assertEquals(45, tree.stats().totalRows);
  tree.add(9, 889);
  assertEquals(46, tree.stats().totalRows);
  tree.remove(9);
  assertEquals(43, tree.stats().totalRows);

  var rows = tree.serialize();
  var tree2 = lf.index.BTree.deserialize(c, 't2', false, rows);
  assertEquals(43, tree2.stats().totalRows);

  rows = insertToTree(23, false).serialize();
  var tree3 = lf.index.BTree.deserialize(c, 't3', true, rows);
  assertEquals(23, tree3.stats().totalRows);
}

function testGetAll() {
  var tree = insertToTree(23, false);
  var expected = SEQUENCE.slice(0).sort(function(a, b) {
    return (a < b) ? -1 : ((a > b) ? 1 : 0);
  });
  assertArrayEquals(expected, tree.getRange());
  assertArrayEquals(
      expected.slice(2, 5),
      tree.getRange(undefined, false, 3, 2));
  assertArrayEquals(
      expected.slice(0, expected.length - 1).reverse(),
      tree.getRange(undefined, true, undefined, 1));

  var tree2 = new lf.index.BTree('t2', c, false);
  for (var i = 1; i < 10; ++i) {
    for (var j = 0; j < 5; ++j) {
      tree2.add(i, i * 10 + j);
    }
  }

  assertArrayEquals([11, 12, 13], tree2.getRange(undefined, false, 3, 1));
  assertArrayEquals([14, 20, 21], tree2.getRange(undefined, false, 3, 4));
  assertArrayEquals([94], tree2.getRange(undefined, false, 10, 44));
  assertArrayEquals([], tree2.getRange(undefined, false, undefined, 99));
}

function manualTestBenchmark() {
  var log = goog.bind(console['log'], console);
  var ROW_COUNT = 1000000;

  stub.reset();

  /** @param {!Array<!lf.Row>} rows */
  var runTest = function(rows) {
    var tree = new lf.index.BTree('test', c, true);
    var start = goog.global.performance.now();
    for (var i = 0; i < ROW_COUNT; i++) {
      tree.add(values[i], i);
    }
    var end = goog.global.performance.now();
    log('btree, normal construct:', end - start);

    var data = rows.map(function(row, i) {
      return [values[i], row.id()];
    });
    var sortedData = data.sort(function(lhs, rhs) {
      return (lhs[0] < rhs[0]) ? -1 : ((lhs[0] > rhs[0]) ? 1 : 0);
    });

    start = goog.global.performance.now();
    new lf.index.BTree('test', c, true, sortedData);
    end = goog.global.performance.now();
    log('btree, sorted construct:', end - start);
  };

  var set = new goog.structs.Set();
  while (set.getCount() < ROW_COUNT) {
    set.add(Math.random() * ROW_COUNT);
  }

  var rows = [];
  var values = set.getValues();
  for (var i = 0; i < ROW_COUNT; i++) {
    rows.push(new lf.Row(i, {key: values[i]}));
  }
  runTest(rows);
  set.clear();
  while (set.getCount() < ROW_COUNT) {
    set.add(goog.string.getRandomString());
  }

  rows = [];
  values = set.getValues();
  for (var i = 0; i < ROW_COUNT; i++) {
    rows.push(new lf.Row(i, {key: values[i]}));
  }
  runTest(rows);
}
