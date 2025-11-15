import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function SignalDashboard() {
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    fetch("/api/signals")
      .then((res) => res.json())
      .then((data) => setSignals(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">AI Trading Signals Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {signals.map((signal, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl rounded-2xl p-4">
              <CardContent>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-semibold">{signal.symbol}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-white text-sm ${
                      signal.type === "BUY" ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {signal.type}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-2">
                  Time: {signal.timestamp}
                </p>
                <p className="text-gray-800 text-lg">Price: {signal.price}</p>

                {signal.stoploss && (
                  <p className="text-gray-700 mt-2 text-sm">
                    SL: {signal.stoploss}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
