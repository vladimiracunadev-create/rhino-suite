use office_core::{DocumentCommand, OfficeEngine};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = OfficeEngine)]
pub struct WasmOfficeEngine {
    inner: OfficeEngine,
}

#[wasm_bindgen(js_class = OfficeEngine)]
impl WasmOfficeEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String, title: String, now_ms: f64) -> Self {
        Self {
            inner: OfficeEngine::new_text_document(id, title, safe_timestamp(now_ms)),
        }
    }

    #[wasm_bindgen(js_name = fromJson)]
    pub fn from_json(json: &str) -> Result<WasmOfficeEngine, JsValue> {
        let inner = OfficeEngine::from_json(json).map_err(to_js_error)?;
        Ok(Self { inner })
    }

    #[wasm_bindgen(js_name = applyJson)]
    pub fn apply_json(&mut self, command_json: &str, now_ms: f64) -> Result<String, JsValue> {
        let command: DocumentCommand =
            serde_json::from_str(command_json).map_err(|error| to_js_error(error.to_string()))?;
        self.inner
            .apply(command, safe_timestamp(now_ms))
            .map_err(to_js_error)?;
        self.document_json()
    }

    pub fn undo(&mut self, now_ms: f64) -> Result<String, JsValue> {
        self.inner.undo(safe_timestamp(now_ms));
        self.document_json()
    }

    pub fn redo(&mut self, now_ms: f64) -> Result<String, JsValue> {
        self.inner.redo(safe_timestamp(now_ms));
        self.document_json()
    }

    #[wasm_bindgen(js_name = documentJson)]
    pub fn document_json(&self) -> Result<String, JsValue> {
        self.inner.to_json().map_err(to_js_error)
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    #[wasm_bindgen(js_name = canRedo)]
    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }
}

fn safe_timestamp(value: f64) -> u64 {
    if value.is_finite() && value >= 0.0 {
        value.round() as u64
    } else {
        0
    }
}

fn to_js_error(error: impl ToString) -> JsValue {
    JsValue::from_str(&error.to_string())
}
