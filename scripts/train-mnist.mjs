/**
 * Train a small CNN on MNIST and save the model for browser use.
 * Run once:  node scripts/train-mnist.mjs
 */
import tf from '@tensorflow/tfjs-node'
import mnist from 'mnist'

const NUM_TRAIN = 10000
const NUM_TEST = 2000
const EPOCHS = 8
const BATCH_SIZE = 128
const MODEL_DIR = 'file://./public/mnist-model'

console.log('Generating MNIST data...')
const { training, test } = mnist.set(NUM_TRAIN, NUM_TEST)

function toTensors(data) {
  // mnist package returns flat 784-element arrays – concat into typed arrays
  const xBuf = new Float32Array(data.length * 784)
  const yBuf = new Float32Array(data.length * 10)
  for (let i = 0; i < data.length; i++) {
    xBuf.set(data[i].input, i * 784)
    yBuf.set(data[i].output, i * 10)
  }
  const xs = tf.tensor4d(xBuf, [data.length, 28, 28, 1])
  const ys = tf.tensor2d(yBuf, [data.length, 10])
  return { xs, ys }
}

console.log('Preparing tensors...')
const train = toTensors(training)
const testData = toTensors(test)

// Build a small CNN
const model = tf.sequential()

model.add(tf.layers.conv2d({
  inputShape: [28, 28, 1],
  filters: 16,
  kernelSize: 3,
  activation: 'relu',
}))
model.add(tf.layers.maxPooling2d({ poolSize: 2 }))

model.add(tf.layers.conv2d({
  filters: 32,
  kernelSize: 3,
  activation: 'relu',
}))
model.add(tf.layers.maxPooling2d({ poolSize: 2 }))

model.add(tf.layers.flatten())
model.add(tf.layers.dropout({ rate: 0.25 }))
model.add(tf.layers.dense({ units: 64, activation: 'relu' }))
model.add(tf.layers.dense({ units: 10, activation: 'softmax' }))

model.compile({
  optimizer: 'adam',
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy'],
})

model.summary()

console.log(`\nTraining on ${NUM_TRAIN} samples for ${EPOCHS} epochs...`)
await model.fit(train.xs, train.ys, {
  epochs: EPOCHS,
  batchSize: BATCH_SIZE,
  validationData: [testData.xs, testData.ys],
  callbacks: {
    onEpochEnd: (epoch, logs) => {
      console.log(
        `  Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)} acc=${logs.acc.toFixed(4)} ` +
        `val_loss=${logs.val_loss.toFixed(4)} val_acc=${logs.val_acc.toFixed(4)}`
      )
    },
  },
})

console.log(`\nSaving model to ${MODEL_DIR}...`)
await model.save(MODEL_DIR)
console.log('Done! Model saved to public/mnist-model/')

// Cleanup
train.xs.dispose()
train.ys.dispose()
testData.xs.dispose()
testData.ys.dispose()
