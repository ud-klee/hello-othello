let _tf = null;
let _model = null;

export async function init(tf, backend, modelDir) {
  _tf = tf;
  if (backend) {
    _tf.setBackend(backend)
  }
  console.info(`[keras] Using TF backend:`, tf.getBackend());
  _model = await _tf.loadLayersModel(`${modelDir}/model.json`);
}

/**
 * 
 * @param {Array} inputs Elements are in the shape [64].
 * @returns 
 */
export async function predict(inputs) {
  inputs = _tf.tensor(inputs, [inputs.length, 8, 8, 1])
  inputs = _tf.div(inputs, _tf.scalar(255))
  const result = _model.predict(inputs)
  const data = await result.data()
  const prediction = []
  for (let i = 0; i < data.length; i += 3) {
    prediction.push(data.slice(i, i + 3))
  }
  return prediction
}
